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
import { buildAuditEncryptionAad, decryptAuditSnapshot } from '../../../infrastructure/audit/audit-encryption.util';

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
    const subject = await this.resolveSubjectContext(row);
    return this.presentAuditRow(row, actor, user, true, faceVerified, subject);
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
      fieldsChanged: row.fieldsChanged ?? row.diffJson?.fieldsChanged ?? [],
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

    if (!includeDetail) return base;

    return {
      ...base,
      encryptedSnapshots: {
        before: this.describeEncryptedSnapshot(row.beforeEncrypted),
        after: this.describeEncryptedSnapshot(row.afterEncrypted),
      },
      decryptedSnapshots: faceVerified
        ? {
            before: this.decryptAndParse(row.beforeEncrypted, row),
            after: this.decryptAndParse(row.afterEncrypted, row),
          }
        : null,
      sensitiveDetailUnlocked: faceVerified,
    };
  }

  private decryptAndParse(encrypted: any, row: any): any {
    if (!encrypted) return null;
    try {
      const aad = buildAuditEncryptionAad({
        seq: row.seq,
        entity: row.entity,
        entityId: row.entityId,
        action: row.action,
        createdAtIso: row.createdAt instanceof Date ? row.createdAt.toISOString() : new Date(row.createdAt).toISOString(),
      });
      const decrypted = decryptAuditSnapshot(encrypted, aad);
      return JSON.parse(decrypted);
    } catch (err) {
      console.warn(`[AuditController] Decryption failed for seq=${row.seq}:`, err);
      return null;
    }
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

    if (row.entity === 'StaffProfile') {
      const staff = await this.prisma.staffProfile.findUnique({
        where: { id: row.entityId },
        select: { id: true, userId: true, fullName: true, employeeCode: true, departmentId: true, department: { select: { name: true } } },
      });
      if (!staff) return base;
      return { ...base, label: 'Nhân sự', code: staff.employeeCode, displayName: staff.fullName, linkedUserId: staff.userId, departmentId: staff.departmentId, departmentName: staff.department?.name ?? null };
    }

    if (row.entity === 'Patient') {
      const patient = await this.prisma.patient.findUnique({
        where: { id: row.entityId },
        select: { id: true, patientCode: true, fullName: true },
      });
      if (!patient) return base;
      return { ...base, label: 'Bệnh nhân', code: patient.patientCode, displayName: patient.fullName, patientId: patient.id };
    }

    if (row.entity === 'Visit') {
      const visit = await this.prisma.visit.findUnique({
        where: { id: row.entityId },
        select: { id: true, visitCode: true, patientId: true, departmentId: true, patient: { select: { fullName: true, patientCode: true } }, department: { select: { name: true } } },
      });
      if (!visit) return base;
      return { ...base, label: 'Lượt khám', code: visit.visitCode, displayName: `${visit.patient?.fullName ?? 'Bệnh nhân'} · ${visit.visitCode}`, departmentId: visit.departmentId, departmentName: visit.department?.name ?? null, patientId: visit.patientId, visitId: visit.id };
    }

    if (row.entity === 'MedicalConclusion') {
      const conclusion = await this.prisma.medicalConclusion.findUnique({
        where: { id: row.entityId },
        select: { id: true, visitId: true, visit: { select: { visitCode: true, patientId: true, patient: { select: { fullName: true } }, departmentId: true, department: { select: { name: true } } } } },
      });
      if (!conclusion) return base;
      return { ...base, label: 'Kết luận khám', code: conclusion.visit?.visitCode ?? null, displayName: `${conclusion.visit?.patient?.fullName ?? 'Bệnh nhân'} · Kết luận`, departmentId: conclusion.visit?.departmentId ?? null, departmentName: conclusion.visit?.department?.name ?? null, patientId: conclusion.visit?.patientId ?? null, visitId: conclusion.visitId };
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
