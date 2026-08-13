import { Body, Controller, Get, Param, ParseIntPipe, Post, Query, UseGuards, NotFoundException } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { AuditLoggerService } from '../../../infrastructure/audit/audit-logger.service';
import { AuditAnchorService } from '../../../infrastructure/audit/audit-anchor.service';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { AuthUser } from '../../../common/types/auth-user.type';
import { toDisplayAuditDiff, toDisplayAuditFields } from '../../../infrastructure/audit/audit-diff.util';
import { verifyAuditRow, verifyAuditRowLight } from '../../../infrastructure/audit/audit-verification.util';
import { FaceStepUpGuard } from '../../../common/stepup/face-stepup.guard';
import { RequireFaceStepUp } from '../../../common/stepup/require-face-stepup.decorator';
import { AuditRecoveryService } from '../../../infrastructure/audit/audit-recovery.service';
import { RecoverAuditBatchDto } from '../dto/recover-audit-batch.dto';
import { EntityRecoveryService } from '../../../infrastructure/audit/entity-recovery.service';
import { BlockchainService } from '../../../infrastructure/blockchain/blockchain.service';
import { PreviewRecoverAuditEntitiesDto, RecoverAuditEntitiesDto } from '../dto/recover-audit-entities.dto';
import type { AuditBatch, BlockchainLogger, Prisma } from '@prisma/client';

const UNFINALIZED_AUDIT_BATCH_STATUSES = new Set([
  'PENDING',
  'PREPARING',
  'ARTIFACT_READY',
  'ON_CHAIN_CONFIRMED',
]);

type AuditBatchMembership = Pick<AuditBatch, 'batchId' | 'fromSeq' | 'toSeq' | 'status'>;
type AuditBatchRows = Map<number, BlockchainLogger[]>;

/**
 * Admin-only audit + integrity API. Surfaces the tamper-evidence machinery so it can be
 * demonstrated and operated:
 *  - history:    paginated audit log (the hash-chained BlockchainLogger).
 *  - verifyChain: walk the off-chain hash-chain, flagging any altered/removed/reordered row.
 *  - batches:    list committed Merkle checkpoints (on-chain anchors).
 *  - proof:      Merkle inclusion proof for a single log, independently verifiable.
 *  - anchorNow:  force-seal+commit the current batch (Tier-A / on-demand).
 */
@UseGuards(JwtAuthGuard, RolesGuard, FaceStepUpGuard)
@Roles('ADMIN')
@ApiTags('Audit & Integrity')
@ApiBearerAuth()
@Controller('audit')
export class AuditController {
  constructor(
    private readonly audit: AuditLoggerService,
    private readonly anchor: AuditAnchorService,
    private readonly prisma: PrismaService,
    private readonly recovery: AuditRecoveryService,
    private readonly entityRecovery: EntityRecoveryService,
    private readonly blockchain: BlockchainService,
  ) {}

  @Get('recovery/deep-scan/status')
  @ApiOperation({ summary: 'Get real-time status & logs of background audit deep-scan and self-healing' })
  getDeepScanStatus() {
    return this.recovery.getDeepScanStatus();
  }

  @Get('recovery/watchdog/status')
  @ApiOperation({ summary: 'Get background 20-minute watchdog auto-heal status and schedule' })
  getWatchdogStatus() {
    return this.recovery.getWatchdogStatus();
  }

  @Post('recovery/deep-scan')
  @RequireFaceStepUp('DEEP_SCAN_SELF_HEAL')
  @ApiOperation({ summary: 'Trigger Face-authenticated deep-scan verification and automated batch self-healing' })
  startDeepScan(@CurrentUser() user: AuthUser) {
    return this.recovery.startDeepScanAndSelfHeal(user.sub);
  }

  @Get('recovery/entities/warnings')
  @ApiOperation({ summary: 'List business entities whose live data differs from the latest anchored audit snapshot' })
  entityWarnings(@Query('limit') limitRaw?: string) {
    const limit = Math.min(Math.max(Number(limitRaw) || 100, 1), 200);
    return this.entityRecovery.listWarnings(limit);
  }

  @Post('recovery/entities')
  @ApiOperation({ summary: 'Recover selected business entities from verified encrypted audit snapshots' })
  recoverEntities(@Body() body: RecoverAuditEntitiesDto, @CurrentUser() user: AuthUser) {
    return this.entityRecovery.recoverMany(body.items, user.sub, body.reason.trim());
  }

  @Post('recovery/entities/preview')
  @ApiOperation({ summary: 'Preview entity recovery without returning decrypted audit snapshots' })
  previewRecoverEntities(@Body() body: PreviewRecoverAuditEntitiesDto) {
    return this.entityRecovery.previewMany(body.items);
  }

  @Get('logs')
  @ApiOperation({ summary: 'List audit log entries (hash-chained) with pagination, sort & batch filter' })
  async logs(
    @Query('entity') entity?: string,
    @Query('entityId') entityId?: string,
    @Query('q') qRaw?: string,
    @Query('action') action?: string,
    @Query('actorId') actorId?: string,
    @Query('from') fromRaw?: string,
    @Query('to') toRaw?: string,
    @Query('verificationStatus') verificationStatus?: string,
    @Query('batch') batchRaw?: string,
    @Query('sort') sortRaw?: string,
    @Query('page') pageRaw?: string,
    @Query('limit') limitRaw?: string,
    @CurrentUser() user?: AuthUser,
  ) {
    const page = Math.max(Number(pageRaw) || 1, 1);
    const limit = Math.min(Math.max(Number(limitRaw) || 10, 1), 100);
    const skip = (page - 1) * limit;
    // Display order only — the tamper-evident chain itself is always keyed by the monotonic seq.
    const sort: 'asc' | 'desc' = sortRaw === 'asc' ? 'asc' : 'desc';

    const where: any = {};
    if (entity) where.entity = entity;
    if (entityId?.trim()) where.entityId = entityId.trim();
    if (action) where.action = action;
    if (actorId) where.actorId = actorId;
    if (verificationStatus) where.onChainStatus = verificationStatus;
    const from = fromRaw ? new Date(fromRaw) : null;
    const to = toRaw ? new Date(toRaw) : null;
    if ((from && !Number.isNaN(from.getTime())) || (to && !Number.isNaN(to.getTime()))) {
      where.createdAt = {
        ...(from && !Number.isNaN(from.getTime()) ? { gte: from } : {}),
        ...(to && !Number.isNaN(to.getTime()) ? { lte: to } : {}),
      };
    }
    if (batchRaw !== undefined && batchRaw !== '' && Number.isFinite(Number(batchRaw))) {
      where.batchId = Number(batchRaw);
    }

    const q = qRaw?.trim();
    if (q) {
      const subjectFilters = await this.buildSubjectSearchFilters(q);
      where.AND = [
        ...(where.AND || []),
        {
          OR: [
            { entityId: q },
            { entityId: { contains: q, mode: 'insensitive' } },
            { action: { contains: q, mode: 'insensitive' } },
            { entity: { contains: q, mode: 'insensitive' } },
            ...subjectFilters,
          ],
        },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.blockchainLogger.findMany({
        where,
        orderBy: { seq: sort },
        skip,
        take: limit,
      }),
      this.prisma.blockchainLogger.count({ where }),
    ]);

    // Enrich each row with the actor's identity (username + role + display name). The logger only
    // stores actorId, so we resolve the distinct ids in ONE batched query (no N+1) and map them
    // back. Admins display their admin username; staff roles display their full name.
    const actorIds = [...new Set(items.map((r) => r.actorId).filter((id): id is string => Boolean(id)))];
    const actors = actorIds.length
      ? await this.prisma.user.findMany({
          where: { id: { in: actorIds } },
          select: {
            id: true,
            username: true,
            email: true,
            role: true,
            staffProfile: { select: { fullName: true } },
            adminProfile: { select: { adminUserName: true } },
          },
        })
      : [];    const actorMap = new Map(actors.map((a) => [a.id, a]));
    const subjectMap = await this.resolveSubjectContextMap(items);

    const itemsWithStatus = items.map((row) => {
      const actor = row.actorId ? actorMap.get(row.actorId) : null;
      return this.presentAuditRow(row, actor, user, false, false, subjectMap.get(this.subjectKey(row)) ?? null);
    });

    return {
      items: itemsWithStatus,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  @Get('verify-chain')
  @ApiOperation({ summary: 'Verify the off-chain hash-chain integrity end to end' })
  verifyChain() {
    return this.audit.verifyChain();
  }

  @Get('batches')
  @ApiOperation({ summary: 'List on-chain Merkle anchor checkpoints with pagination' })
  async batches(
    @Query('page') pageRaw?: string,
    @Query('limit') limitRaw?: string,
    @Query('sortBy') sortByRaw?: string,
    @Query('sort') sortRaw?: string,
  ) {
    const page = Math.max(Number(pageRaw) || 1, 1);
    const limit = Math.min(Math.max(Number(limitRaw) || 10, 1), 100);
    const skip = (page - 1) * limit;
    const sortDir: 'asc' | 'desc' = sortRaw === 'asc' ? 'asc' : 'desc';
    const sortBy = (sortByRaw || 'batchId').toLowerCase();

    const localBatches = await this.prisma.auditBatch.findMany({
      select: {
        id: true,
        batchId: true,
        merkleRoot: true,
        leafCount: true,
        fromSeq: true,
        toSeq: true,
        status: true,
        algorithmVersion: true,
        contractVersion: true,
        artifactHash: true,
        artifactUri: true,
        txHash: true,
        blockNumber: true,
        error: true,
        createdAt: true,
        anchoredAt: true,
        recoveredAt: true,
      },
    });

    const localMap = new Map(localBatches.map((b) => [b.batchId, b]));
    const allMergedItems: any[] = [...localBatches];

    try {
      const latestOnChain = await this.blockchain.getLatestAuditBatchId();
      if (latestOnChain && latestOnChain > 0) {
        // Fast path: if local DB has all on-chain batches, no RPC range fetch needed
        const missingOnChainIds: number[] = [];
        for (let bId = 1; bId <= latestOnChain; bId++) {
          if (!localMap.has(bId)) missingOnChainIds.push(bId);
        }

        if (missingOnChainIds.length > 0) {
          const checkpoints = await this.blockchain.getAuditCheckpointsRange(1, latestOnChain);
          for (const cp of checkpoints) {
            if (cp.committed && !localMap.has(cp.batchId)) {
              allMergedItems.push({
                id: `missing-batch-${cp.batchId}`,
                batchId: cp.batchId,
                merkleRoot: cp.root,
                leafCount: cp.leafCount,
                fromSeq: null,
                toSeq: null,
                status: 'MISSING',
                algorithmVersion: 'MERKLE_SHA256_STRING_V1',
                contractVersion: 'AUDIT_ANCHOR_CHECKPOINT_V2',
                artifactHash: cp.artifactHash,
                artifactUri: cp.artifactUri,
                txHash: null,
                blockNumber: null,
                error: 'Lô bị xóa khỏi Database local',
                createdAt: new Date(cp.timestamp * 1000).toISOString(),
                anchoredAt: new Date(cp.timestamp * 1000).toISOString(),
                recoveredAt: null,
                isMissingFromLocal: true,
              });
            }
          }
        }
      }
    } catch {
      // Fallback to local DB if blockchain read fails
    }

    allMergedItems.sort((a, b) => {
      if (sortBy === 'time' || sortBy === 'anchoredat' || sortBy === 'createdat') {
        const timeA = new Date(a.anchoredAt || a.createdAt).getTime();
        const timeB = new Date(b.anchoredAt || b.createdAt).getTime();
        return sortDir === 'asc' ? timeA - timeB : timeB - timeA;
      }
      return sortDir === 'asc' ? a.batchId - b.batchId : b.batchId - a.batchId;
    });

    const total = allMergedItems.length;
    const paginatedItems = allMergedItems.slice(skip, skip + limit);

    const rowsByBatch = await this.loadBatchRows(paginatedItems.filter((i) => !i.isMissingFromLocal));
    const contentByBatch = await this.buildBatchContentSummaries(rowsByBatch);
    const integrityByBatch = this.buildBatchIntegritySummaries(rowsByBatch);

    return {
      items: paginatedItems.map(({ artifactUri, isMissingFromLocal, ...item }) => ({
        ...item,
        artifactAvailable: Boolean(artifactUri && item.artifactHash),
        contentSummary: isMissingFromLocal
          ? [{ entity: 'AuditBatch', label: 'Bị xóa khỏi DB local', count: item.leafCount || 1 }]
          : (contentByBatch.get(item.batchId) ?? []),
        integrity: isMissingFromLocal
          ? { status: 'CORRUPTED', verified: 0, tampered: 1, pending: 0, total: 1 }
          : (integrityByBatch.get(item.batchId) ?? {
              status: 'PENDING',
              verified: 0,
              tampered: 0,
              pending: 0,
              total: 0,
            }),
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  @Get('batches/:batchId')
  @ApiOperation({ summary: 'Batch detail with all audit seq leaves and integrity summary' })
  async batchDetail(
    @Param('batchId', ParseIntPipe) batchId: number,
    @CurrentUser() user?: AuthUser,
  ) {
    const batch = await this.prisma.auditBatch.findUnique({ where: { batchId } });
    if (!batch) throw new NotFoundException('Không tìm thấy lô audit.');

    const rowsByBatch = await this.loadBatchRows([batch]);
    const rows = rowsByBatch.get(batchId) ?? [];

    const actorIds = [...new Set(rows.map((r) => r.actorId).filter((id): id is string => Boolean(id)))];
    const actors = actorIds.length
      ? await this.prisma.user.findMany({
          where: { id: { in: actorIds } },
          select: {
            id: true,
            username: true,
            email: true,
            role: true,
            staffProfile: { select: { fullName: true } },
            adminProfile: { select: { adminUserName: true } },
          },
        })
      : [];
    const actorMap = new Map(actors.map((a) => [a.id, a]));
    const subjectMap = await this.resolveSubjectContextMap(rows);
    const logs = rows.map((row) =>
      this.presentAuditRow(row, row.actorId ? actorMap.get(row.actorId) : null, user, false, false, subjectMap.get(this.subjectKey(row)) ?? null),
    );
    const integrity = this.summarizeIntegrityFromPresented(logs);
    const contentSummary = (await this.buildBatchContentSummaries(rowsByBatch)).get(batchId) ?? [];

    const { artifactUri, ...safeBatch } = batch as typeof batch & { artifactUri?: string | null };
    return {
      ...safeBatch,
      artifactAvailable: Boolean(artifactUri && batch.artifactHash),
      contentSummary,
      integrity,
      logs,
    };
  }

  @Get('logs/:seq')
  @ApiOperation({ summary: 'Get one audit log with readable diff and V2 verification details' })
  async logDetail(@Param('seq') seq: string, @CurrentUser() user?: AuthUser) {
    const row = await this.prisma.blockchainLogger.findFirst({ where: { seq: Number(seq) } });
    if (!row) throw new NotFoundException('Không tìm thấy audit log.');

    const actor = row.actorId
      ? await this.prisma.user.findUnique({
          where: { id: row.actorId },
          select: {
            id: true,
            username: true,
            email: true,
            role: true,
            staffProfile: { select: { fullName: true } },
            adminProfile: { select: { adminUserName: true } },
          },
        })
      : null;

    const subject = await this.resolveSubjectContext(row);
    return this.presentAuditRow(row, actor, user, true, false, subject);
  }

  @Get('logs/:seq/proof')
  @ApiOperation({ summary: 'Merkle inclusion proof for one log, verified against the on-chain root' })
  proof(@Param('seq') seq: string) {
    return this.anchor.getInclusionProof(Number(seq));
  }

  @Post('anchor-now')
  @ApiOperation({ summary: 'Force-seal the pending batch and commit its Merkle root on-chain' })
  anchorNow() {
    return this.anchor.anchorNow();
  }

  @Post('recovery/:batchId')
  @RequireFaceStepUp('RECOVER_AUDIT_BATCH')
  @ApiOperation({ summary: 'Recover one tampered audit batch from its verified IPFS artifact' })
  recoverBatch(
    @Param('batchId', ParseIntPipe) batchId: number,
    @Body() body: RecoverAuditBatchDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.recovery.recover(batchId, user.sub, body.reason);
  }

  private presentAuditRow(row: any, actor: any, user: AuthUser | undefined, includeDetail: boolean, faceVerified = false, subject: any = null) {
    // List: cheap hash recompute (no decrypt). Detail: full V2 decrypt + recompute.
    const verification = includeDetail ? verifyAuditRow(row) : verifyAuditRowLight(row);
    const diff = row.diffJson?.schema === 'KLTN_AUDIT_DIFF_V1'
      ? toDisplayAuditDiff(row.diffJson, {
          role: user?.role,
          faceVerified,
          clinicalContextAllowed: includeDetail && faceVerified,
          entity: row.entity,
        })
      : [];
    const base = {
      id: row.id,
      seq: row.seq,
      entity: row.entity,
      entityId: row.entityId,
      action: row.action,
      actorId: row.actorId,
      createdAt: row.createdAt,
      hashVersion: row.hashVersion,
      onChainStatus: row.onChainStatus,
      txHash: row.txHash,
      blockNumber: row.blockNumber,
      batchId: row.batchId,
      blockchainStatus: verification.status,
      verification: {
        ok: verification.ok,
        status: verification.status,
        version: verification.version,
        reason: verification.reason,
        suspiciousFields: verification.suspiciousFields,
      },
      actor: actor
        ? {
            id: actor.id,
            username: actor.username,
            email: actor.email,
            role: actor.role,
            displayName: actor.staffProfile?.fullName || actor.adminProfile?.adminUserName || actor.username,
          }
        : null,
      diff,
      fieldsChanged: toDisplayAuditFields(row.fieldsChanged ?? row.diffJson?.fieldsChanged),
      subject,
      hashes: {
        dataHash: row.dataHash,
        beforeHash: row.beforeHash,
        afterHash: row.afterHash,
        diffHash: row.diffHash,
        entryHash: row.entryHash,
        prevHash: row.prevHash,
      },
    };

    // Audit endpoints never expose encrypted or decrypted snapshots. Recovery decryption is
    // isolated in the server-side recovery service and is not a viewer capability.
    return base;

  }


  private async loadBatchRows(batches: AuditBatchMembership[]): Promise<AuditBatchRows> {
    const byBatch: AuditBatchRows = new Map(batches.map((batch) => [batch.batchId, []]));
    if (!batches.length) return byBatch;

    const unfinalized = batches.filter(
      (batch) => UNFINALIZED_AUDIT_BATCH_STATUSES.has(batch.status)
        && batch.fromSeq != null
        && batch.toSeq != null,
    );
    const filters: Prisma.BlockchainLoggerWhereInput[] = [
      { batchId: { in: batches.map((batch) => batch.batchId) } },
      ...unfinalized.map((batch) => ({
        batchId: null,
        seq: { gte: batch.fromSeq!, lte: batch.toSeq! },
      })),
    ];
    const rows = await this.prisma.blockchainLogger.findMany({
      where: { OR: filters },
      orderBy: { seq: 'asc' },
    });

    for (const row of rows) {
      const rangeBatchId = row.batchId == null && row.seq != null
        ? unfinalized.find((batch) => row.seq! >= batch.fromSeq! && row.seq! <= batch.toSeq!)?.batchId
        : undefined;
      const batchId = row.batchId ?? rangeBatchId;
      if (batchId == null || !byBatch.has(batchId)) continue;
      byBatch.get(batchId)!.push(row);
    }

    return byBatch;
  }

  private buildBatchIntegritySummaries(byBatch: AuditBatchRows) {
    const map = new Map<
      number,
      { status: 'VERIFIED' | 'TAMPERED' | 'PENDING'; verified: number; tampered: number; pending: number; total: number }
    >();

    for (const [batchId, batchRows] of byBatch.entries()) {
      let verified = 0;
      let tampered = 0;
      let pending = 0;
      for (const row of batchRows) {
        const result = verifyAuditRowLight(row);
        if (result.status === 'VERIFIED') verified += 1;
        else if (result.status === 'TAMPERED') tampered += 1;
        else pending += 1;
      }
      const total = batchRows.length;
      const status: 'VERIFIED' | 'TAMPERED' | 'PENDING' =
        tampered > 0 ? 'TAMPERED' : pending > 0 ? 'PENDING' : total > 0 ? 'VERIFIED' : 'PENDING';
      map.set(batchId, { status, verified, tampered, pending, total });
    }

    return map;
  }

  private summarizeIntegrityFromPresented(
    logs: Array<{ blockchainStatus?: string; verification?: { status?: string } }>,
  ) {
    let verified = 0;
    let tampered = 0;
    let pending = 0;
    for (const log of logs) {
      const status = log.blockchainStatus || log.verification?.status || 'PENDING';
      if (status === 'VERIFIED') verified += 1;
      else if (status === 'TAMPERED') tampered += 1;
      else pending += 1;
    }
    const total = logs.length;
    const status: 'VERIFIED' | 'TAMPERED' | 'PENDING' =
      tampered > 0 ? 'TAMPERED' : pending > 0 ? 'PENDING' : total > 0 ? 'VERIFIED' : 'PENDING';
    return { status, verified, tampered, pending, total };
  }

  /**
   * Map free-text search (department code/name, staff name/code, AI model name)
   * to entityId filters so admins can find "which batch touches room ABC".
   */
  private async buildSubjectSearchFilters(q: string): Promise<Array<Record<string, unknown>>> {
    const filters: Array<Record<string, unknown>> = [];
    const [departments, staffs, aiModels] = await Promise.all([
      this.prisma.department.findMany({
        where: {
          OR: [
            { departmentCode: { contains: q, mode: 'insensitive' } },
            { name: { contains: q, mode: 'insensitive' } },
          ],
        },
        select: { id: true },
        take: 40,
      }),
      this.prisma.staffProfile.findMany({
        where: {
          OR: [
            { fullName: { contains: q, mode: 'insensitive' } },
            { employeeCode: { contains: q, mode: 'insensitive' } },
          ],
        },
        select: { id: true },
        take: 40,
      }),
      this.prisma.aiModelRegistry.findMany({
        where: {
          OR: [
            { modelName: { contains: q, mode: 'insensitive' } },
            { modelId: { contains: q, mode: 'insensitive' } },
          ],
        },
        select: { id: true },
        take: 40,
      }),
    ]);

    if (departments.length) {
      filters.push({ entity: 'Department', entityId: { in: departments.map((d) => d.id) } });
    }
    if (staffs.length) {
      filters.push({ entity: 'StaffProfile', entityId: { in: staffs.map((s) => s.id) } });
    }
    if (aiModels.length) {
      filters.push({ entity: 'AiModelRegistry', entityId: { in: aiModels.map((m) => m.id) } });
    }
    return filters;
  }

  /** Compact "what's inside this batch" for the admin recovery UI. */
  private async buildBatchContentSummaries(byBatch: AuditBatchRows) {
    const map = new Map<number, Array<{ entity: string; count: number; samples: string[] }>>();
    if (!byBatch.size) return map;

    await Promise.all(
      [...byBatch.entries()].map(async ([batchId, batchRows]) => {
        const entityCounts = new Map<string, { count: number; ids: string[] }>();
        for (const row of batchRows) {
          const bucket = entityCounts.get(row.entity) ?? { count: 0, ids: [] };
          bucket.count += 1;
          if (row.entityId && bucket.ids.length < 4 && !bucket.ids.includes(row.entityId)) {
            bucket.ids.push(row.entityId);
          }
          entityCounts.set(row.entity, bucket);
        }

        const summary = await Promise.all(
          [...entityCounts.entries()]
            .sort((a, b) => b[1].count - a[1].count)
            .slice(0, 6)
            .map(async ([entity, info]) => {
              const samples = await this.resolveSampleLabels(entity, info.ids);
              return { entity, count: info.count, samples };
            }),
        );
        map.set(batchId, summary);
      }),
    );

    return map;
  }

  private async resolveSampleLabels(entity: string, ids: string[]): Promise<string[]> {
    if (!ids.length) return [];
    if (entity === 'Department') {
      const rows = await this.prisma.department.findMany({
        where: { id: { in: ids } },
        select: { departmentCode: true, name: true },
      });
      return rows.map((r) => `${r.departmentCode} · ${r.name}`);
    }
    if (entity === 'StaffProfile') {
      const rows = await this.prisma.staffProfile.findMany({
        where: { id: { in: ids } },
        select: { employeeCode: true, fullName: true },
      });
      return rows.map((r) => `${r.employeeCode || 'NV'} · ${r.fullName}`);
    }
    if (entity === 'AiModelRegistry') {
      const rows = await this.prisma.aiModelRegistry.findMany({
        where: { id: { in: ids } },
        select: { modelName: true, modelVersion: true },
      });
      return rows.map((r) => `${r.modelName} v${r.modelVersion}`);
    }
    if (entity === 'Visit' || entity === 'Patient' || entity === 'MedicalConclusion' || entity === 'MedicalResult' || entity === 'MedicalOrder') {
      return ids.map((id) => `${entity} ${id.slice(0, 8)}…`);
    }
    return ids.map((id) => id.slice(0, 10));
  }

  private subjectKey(row: { entity: string; entityId?: string | null }) {
    return `${row.entity}:${row.entityId ?? ''}`;
  }

  private async resolveSubjectContextMap(rows: Array<{ entity: string; entityId?: string | null }>) {
    const map = new Map<string, any>();
    const uniqueRows = Array.from(new Map(rows.filter((row) => row.entityId).map((row) => [this.subjectKey(row), row])).values());
    await Promise.all(uniqueRows.map(async (row) => {
      const subject = await this.resolveSubjectContext(row);
      if (subject) map.set(this.subjectKey(row), subject);
    }));
    return map;
  }

  private async resolveSubjectContext(row: { entity: string; entityId?: string | null }) {
    if (!row.entityId) return null;
    const base = {
      entity: row.entity,
      entityId: row.entityId,
      table: row.entity,
      label: row.entity,
      code: null as string | null,
      displayName: null as string | null,
      linkedUserId: null as string | null,
      departmentId: null as string | null,
      departmentName: null as string | null,
      patientId: null as string | null,
      visitId: null as string | null,
    };

    if (row.entity === 'Patient') {
      return { ...base, label: 'Patient record', displayName: 'Protected medical subject', patientId: row.entityId };
    }
    if (row.entity === 'Visit') {
      return { ...base, label: 'Visit', displayName: 'Protected medical visit', visitId: row.entityId };
    }
    if (row.entity === 'MedicalConclusion' || row.entity === 'MedicalResult' || row.entity === 'MedicalOrder') {
      return { ...base, label: row.entity, displayName: 'Protected clinical record' };
    }

    if (row.entity === 'StaffProfile') {
      const staff = await this.prisma.staffProfile.findUnique({
        where: { id: row.entityId },
        select: { id: true, userId: true, fullName: true, employeeCode: true, departmentId: true, department: { select: { name: true } } },
      });
      if (!staff) return base;
      return { ...base, label: 'Nhân sự', code: staff.employeeCode, displayName: staff.fullName, linkedUserId: staff.userId, departmentId: staff.departmentId, departmentName: staff.department?.name ?? null };
    }

    if (row.entity === 'Department') {
      const department = await this.prisma.department.findUnique({
        where: { id: row.entityId },
        select: { id: true, departmentCode: true, name: true },
      });
      if (!department) return base;
      return { ...base, label: 'Phòng ban', code: department.departmentCode, displayName: department.name, departmentId: department.id, departmentName: department.name };
    }

    return base;
  }

  private describeEncryptedSnapshot(value: any) {
    if (!value || typeof value !== 'object') return null;
    return {
      alg: value.alg ?? null,
      keyId: value.keyId ?? null,
      ivPresent: Boolean(value.iv),
      tagPresent: Boolean(value.tag),
      ciphertextPresent: Boolean(value.ciphertext),
    };
  }
}