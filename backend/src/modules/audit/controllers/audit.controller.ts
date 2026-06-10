import { Controller, Get, Param, Post, Query, UseGuards, NotFoundException, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { FaceStepUpGuard } from '../../../common/stepup/face-stepup.guard';
import { RequireFaceStepUp } from '../../../common/stepup/require-face-stepup.decorator';
import { AuditLoggerService } from '../../../infrastructure/audit/audit-logger.service';
import { AuditAnchorService } from '../../../infrastructure/audit/audit-anchor.service';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { AuthUser } from '../../../common/types/auth-user.type';
import { toDisplayAuditDiff } from '../../../infrastructure/audit/audit-diff.util';
import { verifyAuditRow } from '../../../infrastructure/audit/audit-verification.util';

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
  ) {}

  @Get('logs')
  @ApiOperation({ summary: 'List audit log entries (hash-chained) with pagination, sort & batch filter' })
  async logs(
    @Query('entity') entity?: string,
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

    const where: { entity?: string; batchId?: number } = {};
    if (entity) where.entity = entity;
    if (batchRaw !== undefined && batchRaw !== '' && Number.isFinite(Number(batchRaw))) {
      where.batchId = Number(batchRaw);
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
      : [];
    const actorMap = new Map(actors.map((a) => [a.id, a]));

    const itemsWithStatus = items.map((row) => {
      const actor = row.actorId ? actorMap.get(row.actorId) : null;
      return this.presentAuditRow(row, actor, user, false);
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
  ) {
    const page = Math.max(Number(pageRaw) || 1, 1);
    const limit = Math.min(Math.max(Number(limitRaw) || 10, 1), 100);
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.prisma.auditBatch.findMany({
        orderBy: { batchId: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.auditBatch.count(),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  @Get('logs/:seq')
  @RequireFaceStepUp('AUDIT_DETAIL')
  @ApiOperation({ summary: 'Get one audit log with readable diff and V2 verification details' })
  async logDetail(@Param('seq') seq: string, @CurrentUser() user?: AuthUser, @Req() req?: any) {
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

    const faceVerified = req?.stepUp?.verified === true && req?.stepUp?.action === 'AUDIT_DETAIL';
    return this.presentAuditRow(row, actor, user, true, faceVerified);
  }

  @Get('logs/:seq/proof')
  @ApiOperation({ summary: 'Merkle inclusion proof for one log, verified against the on-chain root' })
  proof(@Param('seq') seq: string) {
    return this.anchor.getInclusionProof(Number(seq));
  }

  @Post('anchor-now')
  @RequireFaceStepUp('ANCHOR_BLOCKCHAIN')
  @ApiOperation({ summary: 'Force-seal the pending batch and commit its Merkle root on-chain (requires face step-up)' })
  anchorNow() {
    return this.anchor.anchorNow();
  }

  private presentAuditRow(row: any, actor: any, user: AuthUser | undefined, includeDetail: boolean, faceVerified = false) {
    const verification = includeDetail
      ? verifyAuditRow(row)
      : {
          ok: true,
          status: 'PENDING' as const,
          version: row.hashVersion ? 'V2' as const : 'V1' as const,
          reason: 'List view does not decrypt encrypted snapshots; open detail or run chain verification for full integrity status.',
          suspiciousFields: [],
        };
    const diff = row.diffJson?.schema === 'KLTN_AUDIT_DIFF_V1'
      ? toDisplayAuditDiff(row.diffJson, {
          role: user?.role,
          faceVerified,
          clinicalContextAllowed: includeDetail && faceVerified,
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
      fieldsChanged: row.fieldsChanged ?? row.diffJson?.fieldsChanged ?? [],
      hashes: {
        dataHash: row.dataHash,
        beforeHash: row.beforeHash,
        afterHash: row.afterHash,
        diffHash: row.diffHash,
        entryHash: row.entryHash,
        prevHash: row.prevHash,
      },
    };

    if (!includeDetail) return base;

    return {
      ...base,
      encryptedSnapshots: {
        before: this.describeEncryptedSnapshot(row.beforeEncrypted),
        after: this.describeEncryptedSnapshot(row.afterEncrypted),
      },
      sensitiveDetailUnlocked: faceVerified,
    };
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
