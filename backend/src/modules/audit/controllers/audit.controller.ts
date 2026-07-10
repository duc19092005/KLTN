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
import { verifyAuditRow } from '../../../infrastructure/audit/audit-verification.util';
import { FaceStepUpGuard } from '../../../common/stepup/face-stepup.guard';
import { RequireFaceStepUp } from '../../../common/stepup/require-face-stepup.decorator';
import { AuditRecoveryService } from '../../../infrastructure/audit/audit-recovery.service';
import { RecoverAuditBatchDto } from '../dto/recover-audit-batch.dto';

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
  ) {}

  @Get('logs')
  @ApiOperation({ summary: 'List audit log entries (hash-chained) with pagination, sort & batch filter' })
  async logs(
    @Query('entity') entity?: string,
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
  ) {
    const page = Math.max(Number(pageRaw) || 1, 1);
    const limit = Math.min(Math.max(Number(limitRaw) || 10, 1), 100);
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.prisma.auditBatch.findMany({
        orderBy: { batchId: 'desc' },
        skip,
        take: limit,
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
      }),
      this.prisma.auditBatch.count(),
    ]);

    return {
      items: items.map(({ artifactUri, ...item }) => ({
        ...item,
        artifactAvailable: Boolean(artifactUri && item.artifactHash),
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
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
    const verification = includeDetail
      ? verifyAuditRow(row)
      : {
          ok: true,
          status: 'PENDING' as const,
          version: row.hashVersion ? 'V2' as const : 'V1' as const,
          reason: 'Danh sách chỉ hiển thị kiểm tra nhanh và không giải mã dữ liệu audit đã mã hóa. Mở chi tiết bản ghi hoặc chạy kiểm tra toàn chuỗi để xem trạng thái toàn vẹn đầy đủ.',
          suspiciousFields: [],
        };
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
