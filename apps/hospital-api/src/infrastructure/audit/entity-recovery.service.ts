import { ConflictException, Injectable, Optional } from '@nestjs/common';
import {
  AppointmentStatus,
  DepartmentType,
  MedicalOrderStatus,
  MedicalSpecialty,
  OperationalStatus,
  Prisma,
  UserStatus,
  VisitSource,
  VisitStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { buildPatientSnapshot } from '../../modules/patient/domain/patient-snapshot';
import { buildDepartmentSnapshot } from '../../modules/department/domain/department-snapshot';
import { buildStaffSnapshot } from '../../modules/staff/domain/staff-snapshot';
import { buildUnifiedDoctorSnapshot } from '../../modules/doctor/domain/doctor-snapshot';
import { buildAiModelSnapshot } from '../../modules/ai-model/domain/ai-model-snapshot';
import { buildMedicalConclusionSnapshot } from '../../modules/clinical-decision/domain/medical-conclusion-snapshot';
import { buildAiDiagnosisSnapshot } from '../../modules/clinical-decision/domain/ai-diagnosis-snapshot';
import { buildVisitSnapshot } from '../../modules/visit/domain/visit-snapshot';
import { buildMedicalOrderSnapshot } from '../../modules/medical-order/domain/medical-order-snapshot';
import { buildMedicalResultSnapshot } from '../../modules/medical-order/domain/medical-result-snapshot';
import { buildAppointmentSnapshot } from '../../modules/patient-portal/domain/appointment-snapshot';
import { buildAiQualitySnapshot } from '../../modules/ai-model/domain/ai-quality-snapshot';
import { AuditAnchorService } from './audit-anchor.service';
import { AuditLoggerService } from './audit-logger.service';
import {
  compareLiveSnapshotToAuditAfter,
  verifyAuditRow,
  verifyAuditRowLight,
} from './audit-verification.util';
import { canonicalize } from './audit-hash.util';
import { EntityRecreationBundleCache, EntityRecreationService } from './entity-recreation.service';

export const RECOVERABLE_AUDIT_ENTITIES = [
  'Patient',
  'Department',
  'StaffProfile',
  'DoctorProfile',
  'AiModelRegistry',
  'Visit',
  'MedicalConclusion',
  'AiDiagnosis',
  'MedicalOrder',
  'MedicalResult',
  'Appointment',
  'AiQuality',
] as const;

export type RecoverableAuditEntity = (typeof RECOVERABLE_AUDIT_ENTITIES)[number];

type DbClient = PrismaService | Prisma.TransactionClient;
type Snapshot = Record<string, unknown>;
type AnchoredAuditRow = NonNullable<Awaited<ReturnType<PrismaService['blockchainLogger']['findFirst']>>>;

export interface EntityRecoveryTarget {
  entity: RecoverableAuditEntity;
  entityId: string;
}

export interface EntityIntegrityWarning {
  entity: RecoverableAuditEntity;
  entityId: string;
  status: 'TAMPERED' | 'AUDIT_UNTRUSTED' | 'MISSING' | 'SNAPSHOT_INCOMPLETE';
  recoverable: boolean;
  latestTrustedSeq: number | null;
  batchId: number | null;
  anchoredAt: Date | null;
  fieldsChanged: string[];
  blockers: string[];
  dependencies: Array<{ entity: string; entityId: string }>;
  recoveryMode: 'DIRECT_ENTITY' | 'DEPENDENCY_CHAIN' | 'AUDIT_BATCH_FIRST' | 'PITR_REQUIRED';
  sensitiveDataHidden: true;
  message: string;
}

const REQUIRED_SNAPSHOT_FIELDS: Record<RecoverableAuditEntity, readonly string[]> = {
  Patient: ['patientCode', 'fullName', 'gender', 'birthDate', 'citizenId', 'phone', 'address', 'insuranceNumber', 'emergencyContact'],
  Department: ['departmentCode', 'name', 'floor', 'status', 'type', 'canReceiveOrders', 'description', 'managerId'],
  StaffProfile: ['employeeCode', 'fullName', 'phone', 'gender', 'citizenId', 'birthDate', 'address', 'avatarUrl', 'departmentId', 'position', 'status'],
  DoctorProfile: ['employeeCode', 'fullName', 'phone', 'gender', 'citizenId', 'birthDate', 'address', 'avatarUrl', 'departmentId', 'position', 'status', 'staffProfileId', 'specialty', 'licenseNumber', 'qualification', 'yearsExperience'],
  AiModelRegistry: ['modelName', 'modelVersion', 'recommendedSpecialty', 'type', 'provider', 'apiEndpoint', 'ipHashPlain', 'description', 'status', 'createdBy'],
  Visit: ['visitCode', 'patientId', 'departmentId', 'staffId', 'status', 'source', 'checkInAt', 'completedAt'],
  MedicalConclusion: ['visitId', 'patientCode', 'doctorId', 'aiDiagnosisId', 'finalDiagnosis', 'treatmentPlan', 'prescription', 'followUpNote', 'doctorNote'],
  AiDiagnosis: ['aiModelId', 'patientId', 'visitId', 'prompt', 'result', 'confidence', 'status', 'reviewedByDoctorId', 'doctorFeedback'],
  MedicalOrder: ['orderId', 'orderCode', 'visitId', 'patientId', 'doctorId', 'targetDepartmentId', 'orderType', 'priority', 'status', 'clinicalNote'],
  MedicalResult: ['resultId', 'resultCode', 'orderId', 'visitId', 'performedById', 'fileCount', 'mimeTypes', 'fileSizes', 'files', 'status', 'note', 'returnedAt', 'createdAt'],
  Appointment: ['appointmentCode', 'patientId', 'departmentId', 'doctorId', 'scheduledAt', 'status', 'doctorStaffId'],
  AiQuality: ['doctorId', 'aiModelId', 'aiDiagnosisId', 'doctorConclusionAboutModel', 'trustablePercent'],
};

const SENSITIVE_FIELDS: Partial<Record<RecoverableAuditEntity, ReadonlySet<string>>> = {
  Patient: new Set(['fullName', 'gender', 'birthDate', 'citizenId', 'phone', 'address', 'insuranceNumber', 'emergencyContact']),
  StaffProfile: new Set(['fullName', 'phone', 'gender', 'citizenId', 'birthDate', 'address', 'avatarUrl']),
  DoctorProfile: new Set(['fullName', 'phone', 'gender', 'citizenId', 'birthDate', 'address', 'avatarUrl']),
  AiModelRegistry: new Set(['apiEndpoint', 'ipHashPlain']),
  Visit: new Set([]),
  MedicalConclusion: new Set(['patientCode', 'finalDiagnosis', 'treatmentPlan', 'prescription', 'followUpNote', 'doctorNote']),
  AiDiagnosis: new Set(['prompt', 'result', 'doctorFeedback']),
  MedicalOrder: new Set(['clinicalNote']),
  MedicalResult: new Set(['note', 'files']),
  Appointment: new Set(['scheduledAt']),
  AiQuality: new Set(['doctorConclusionAboutModel']),
};

@Injectable()
export class EntityRecoveryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLoggerService,
    private readonly anchor: AuditAnchorService,
    @Optional() private readonly recreation?: EntityRecreationService,
  ) {}

  async previewMany(targets: EntityRecoveryTarget[]) {
    const uniqueTargets = [...new Map(targets.map((target) => [this.targetKey(target.entity, target.entityId), target])).values()];
    const items: Array<Record<string, unknown>> = [];
    const recreationCache = this.recreation?.createBundleCache();
    for (const target of uniqueTargets) {
      const live = await this.loadLiveSnapshot(this.prisma, target.entity, target.entityId);
      if (!live) {
        // Entity bị xóa vĩnh viễn có chủ ý — không coi là mất dữ liệu, không đề xuất recreation.
        if (await this.isIntentionallyDeleted(target.entityId)) {
          items.push({ ...target, state: 'INTENTIONALLY_DELETED', operation: 'NONE', recoverable: false, blockers: [], sensitiveDataHidden: true });
          continue;
        }
        if (!this.recreation) {
          items.push({ ...target, state: 'MISSING', operation: 'RECREATE', recoverable: false, blockers: ['ENTITY_RECREATION_UNAVAILABLE'], sensitiveDataHidden: true });
        } else {
          items.push({ ...(await this.recreation.previewOne(target, recreationCache)) });
        }
        continue;
      }

      const row = await this.findLatestRow(target.entity, target.entityId);
      const warning = row ? await this.evaluateRow(row) : null;
      items.push({
        ...target,
        state: 'EXISTS',
        operation: warning?.recoverable ? 'UPDATE' : 'NONE',
        recoverable: Boolean(warning?.recoverable),
        sourceSeq: warning?.latestTrustedSeq ?? null,
        sourceBatchId: warning?.batchId ?? null,
        source: warning?.recoverable ? 'ANCHORED_AUDIT' : null,
        blockers: warning && !warning.recoverable ? warning.blockers : [],
        dependencies: warning?.dependencies ?? [],
        recoveryMode: warning?.recoveryMode ?? 'DIRECT_ENTITY',
        sensitiveDataHidden: true,
      });
    }
    return { items, total: items.length, recoverable: items.filter((item) => item.recoverable === true).length };
  }

  async listWarnings(limit = 100): Promise<{ items: EntityIntegrityWarning[]; total: number }> {
    const groups = await this.prisma.blockchainLogger.groupBy({
      by: ['entity', 'entityId'],
      where: {
        entity: { in: [...RECOVERABLE_AUDIT_ENTITIES] },
        entityId: { not: null },
        seq: { not: null },
      },
      _max: { seq: true },
      orderBy: { _max: { seq: 'desc' } },
      take: Math.min(Math.max(limit, 1), 200),
    });
    const rows = await this.prisma.blockchainLogger.findMany({
      where: { seq: { in: groups.map((group) => group._max.seq).filter((seq): seq is number => seq != null) } },
      orderBy: { seq: 'desc' },
    });

    const latest = new Map<string, AnchoredAuditRow>();
    for (const row of rows) {
      if (!this.isRecoverableEntity(row.entity) || !row.entityId) continue;
      const key = this.targetKey(row.entity, row.entityId);
      if (!latest.has(key)) latest.set(key, row);
    }

    const recreationCache = this.recreation?.createBundleCache();
    const evaluated = await Promise.all(
      Array.from(latest.values()).map((row) => this.evaluateRow(row, recreationCache)),
    );
    const warnings = evaluated.filter((warning): warning is EntityIntegrityWarning => warning !== null);

    return { items: warnings, total: warnings.length };
  }

  async assertTrusted(entity: RecoverableAuditEntity, entityId: string): Promise<void> {
    const row = await this.findLatestRow(entity, entityId);
    if (!row) return;
    const warning = await this.evaluateRow(row);
    if (!warning) return;

    throw new ConflictException({
      statusCode: 409,
      code: 'ENTITY_INTEGRITY_WARNING',
      message: warning.message,
      entity: warning.entity,
      entityId: warning.entityId,
      batchId: warning.batchId,
      latestTrustedSeq: warning.latestTrustedSeq,
      fieldsChanged: warning.fieldsChanged,
      blockers: warning.blockers,
      dependencies: warning.dependencies,
      recoveryMode: warning.recoveryMode,
      recoveryRequired: warning.recoverable,
    });
  }

  async recoverMany(targets: EntityRecoveryTarget[], actorId: string, reason: string) {
    const uniqueTargets = [...new Map(targets.map((target) => [this.targetKey(target.entity, target.entityId), target])).values()];
    const results: Array<Record<string, unknown>> = [];
    const recreationCache = this.recreation?.createBundleCache();

    for (const target of uniqueTargets) {
      try {
        results.push(await this.recoverOne(target, actorId, reason, recreationCache));
      } catch (error) {
        console.error('RECOVERY ERROR:', error);
        results.push({
          ...target,
          status: 'FAILED',
          message: this.safeErrorMessage(error),
        });
      }
    }

    return {
      requested: uniqueTargets.length,
      recovered: results.filter((result) => result.status === 'RECOVERED' || result.status === 'RECREATED').length,
      skipped: results.filter((result) => result.status === 'SKIPPED').length,
      failed: results.filter((result) => result.status === 'FAILED').length,
      results,
    };
  }

  private async recoverOne(
    target: EntityRecoveryTarget,
    actorId: string,
    reason: string,
    recreationCache?: EntityRecreationBundleCache,
  ) {
    const liveSnapshot = await this.loadLiveSnapshot(this.prisma, target.entity, target.entityId);
    if (!liveSnapshot) {
      // Nếu entity đã bị xóa vĩnh viễn có chủ ý, không cho phép recovery qua luồng này.
      if (await this.isIntentionallyDeleted(target.entityId)) {
        throw new ConflictException(
          `Entity '${target.entity}' (${target.entityId}) đã bị xóa vĩnh viễn có chủ ý. Không thể khôi phục qua luồng entity recovery.`,
        );
      }
      if (!this.recreation) throw new ConflictException('Entity recreation service chưa được cấu hình.');
      return this.recreation.recreate(target, actorId, reason, recreationCache);
    }

    const row = await this.findLatestCompleteAnchoredRow(target.entity, target.entityId);
    if (!row || row.seq == null || row.batchId == null) {
      throw new ConflictException('Không có audit đã neo để làm nguồn khôi phục.');
    }

    const verification = verifyAuditRow(row);
    if (!verification.ok) {
      throw new ConflictException('Audit nguồn không toàn vẹn; phải phục hồi audit batch từ IPFS trước.');
    }
    const sourceSnapshot = this.requireCompleteSnapshot(target.entity, verification.decryptedAfter);
    const proof = await this.anchor.getInclusionProof(row.seq);
    if (!proof?.verified) {
      throw new ConflictException('Không xác minh được audit nguồn với Merkle root trên blockchain.');
    }

    const snapshot = this.effectiveRecoverySnapshot(target.entity, sourceSnapshot, liveSnapshot);
    if (this.snapshotsEqual(snapshot, liveSnapshot)) {
      return { ...target, status: 'SKIPPED', sourceSeq: row.seq, batchId: row.batchId };
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`audit-entity-recovery:${target.entity}:${target.entityId}`}))`;
      const current = await this.loadLiveSnapshot(tx, target.entity, target.entityId);
      if (!current) throw new ConflictException('Bản ghi đã bị xóa trong lúc khôi phục.');
      const transactionSnapshot = this.effectiveRecoverySnapshot(target.entity, sourceSnapshot, current);
      if (this.snapshotsEqual(transactionSnapshot, current)) return;

      await this.restoreSnapshot(tx, target.entity, target.entityId, transactionSnapshot);
      const restored = await this.loadLiveSnapshot(tx, target.entity, target.entityId);
      if (!restored) throw new ConflictException('Không đọc lại được bản ghi sau khôi phục.');
      if (!this.snapshotsEqual(transactionSnapshot, restored)) {
        throw new ConflictException('Dữ liệu sau khôi phục vẫn không khớp audit nguồn.');
      }

      const integrity = this.audit.hashSnapshot(restored);
      await this.updateIntegrityHash(tx, target.entity, target.entityId, integrity.hash, integrity.salt);
      await this.audit.recordV2({
        entity: target.entity,
        entityId: target.entityId,
        action: 'AUDIT_ENTITY_RECOVERED',
        actorId,
        before: current,
        after: restored,
        metadata: { reason, sourceSeq: row.seq, sourceBatchId: row.batchId },
      }, tx);
    });

    return { ...target, status: 'RECOVERED', sourceSeq: row.seq, batchId: row.batchId };
  }

  private async evaluateRow(
    row: AnchoredAuditRow,
    recreationCache?: EntityRecreationBundleCache,
  ): Promise<EntityIntegrityWarning | null> {
    if (!this.isRecoverableEntity(row.entity) || !row.entityId) return null;
    const entity = row.entity;
    const base = {
      entity,
      entityId: row.entityId,
      latestTrustedSeq: row.seq,
      batchId: row.batchId,
      anchoredAt: row.createdAt,
      sensitiveDataHidden: true as const,
    };

    const lightVerification = verifyAuditRowLight(row);
    if (!lightVerification.ok) {
      return {
        ...base,
        status: 'AUDIT_UNTRUSTED',
        recoverable: false,
        fieldsChanged: this.safeFieldNames(entity, lightVerification.suspiciousFields),
        blockers: ['AUDIT_ROW_INTEGRITY_FAILED'], dependencies: [], recoveryMode: 'AUDIT_BATCH_FIRST',
        message: 'Audit nguồn có dấu hiệu sai lệch. Hãy phục hồi audit batch từ IPFS trước.',
      };
    }

    const liveSnapshot = await this.loadLiveSnapshot(this.prisma, entity, row.entityId);
    if (!liveSnapshot) {
      // Entity đã bị xóa vĩnh viễn có chủ ý bởi admin — không phải lỗi integrity, không cảnh báo.
      if (await this.isIntentionallyDeleted(row.entityId)) return null;

      const preview = this.recreation
        ? await this.recreation.previewOne({ entity, entityId: row.entityId }, recreationCache)
        : null;
      return {
        ...base,
        status: 'MISSING',
        recoverable: Boolean(preview?.recoverable),
        latestTrustedSeq: preview?.sourceSeq ?? base.latestTrustedSeq,
        batchId: preview?.sourceBatchId ?? base.batchId,
        fieldsChanged: [],
        blockers: preview?.blockers ?? ['ENTITY_RECREATION_UNAVAILABLE'],
        dependencies: preview?.dependencies ?? [],
        recoveryMode: preview?.recoveryMode ?? 'PITR_REQUIRED',
        message: preview?.recoverable
          ? preview.recoveryMode === 'DEPENDENCY_CHAIN'
            ? 'Bản ghi gốc và entity cha không còn tồn tại, nhưng có đủ snapshot IPFS đã xác minh để khôi phục theo chuỗi khóa ngoại.'
            : 'Bản ghi gốc không còn tồn tại nhưng có snapshot IPFS đã xác minh để tạo lại.'
          : `Không thể khôi phục tự động: ${(preview?.blockers ?? ['không có snapshot tin cậy']).join(', ')}.`,
      };
    }

    const verification = verifyAuditRow(row);

    if (!this.hasCompleteSnapshot(entity, verification.decryptedAfter)) {
      const partialComparison = this.compareCommittedSnapshotFields(
        entity,
        verification.decryptedAfter,
        liveSnapshot,
      );
      if (partialComparison.ok) return null;

      // Fallback: bản ghi mới nhất có thể là UPDATE thiếu trường (snapshot cũ hạn chế).
      // Scan các dòng ANCHORED cũ hơn để tìm snapshot đầy đủ làm nguồn so sánh.
      const completeRow = await this.findLatestCompleteAnchoredRow(entity, row.entityId);
      if (completeRow && completeRow.seq !== row.seq) {
        const completeVerification = verifyAuditRow(completeRow);
        if (completeVerification.ok) {
          const completeSnapshot = completeVerification.decryptedAfter as Snapshot;
          const effectiveSnapshot = this.effectiveRecoverySnapshot(entity, completeSnapshot, liveSnapshot);
          const comparison = this.snapshotsEqual(effectiveSnapshot, liveSnapshot)
            ? { ok: true, suspiciousFields: [] as string[] }
            : compareLiveSnapshotToAuditAfter(completeRow, liveSnapshot);
          if (comparison.ok) return null;

          const proof = completeRow.seq == null ? null : await this.anchor.getInclusionProof(completeRow.seq);
          return {
            ...base,
            status: proof?.verified ? 'TAMPERED' : 'AUDIT_UNTRUSTED',
            recoverable: Boolean(proof?.verified),
            latestTrustedSeq: completeRow.seq,
            batchId: completeRow.batchId,
            anchoredAt: completeRow.createdAt,
            fieldsChanged: this.safeFieldNames(entity, comparison.suspiciousFields),
            blockers: proof?.verified ? [] : ['BLOCKCHAIN_PROOF_FAILED'],
            dependencies: [], recoveryMode: proof?.verified ? 'DIRECT_ENTITY' : 'AUDIT_BATCH_FIRST',
            message: proof?.verified
              ? 'Dữ liệu hiện tại lệch với snapshot audit đầy đủ gần nhất (bản ghi mới nhất thiếu trường do snapshot cũ hạn chế).'
              : 'Dữ liệu lệch và audit nguồn đầy đủ gần nhất chưa xác minh được với blockchain.',
          };
        }
      }

      if (row.onChainStatus !== 'ANCHORED' || row.batchId == null) {
        return {
          ...base,
          status: 'AUDIT_UNTRUSTED',
          recoverable: false,
          fieldsChanged: this.safeFieldNames(entity, partialComparison.suspiciousFields),
          blockers: ['LATEST_AUDIT_NOT_ANCHORED', 'SNAPSHOT_INCOMPLETE'], dependencies: [], recoveryMode: 'PITR_REQUIRED',
          message: 'Các trường được audit ghi nhận đang lệch, nhưng snapshot nguồn cũ chưa đầy đủ và chưa được neo.',
        };
      }

      const proof = row.seq == null ? null : await this.anchor.getInclusionProof(row.seq);
      return {
        ...base,
        status: proof?.verified ? 'TAMPERED' : 'AUDIT_UNTRUSTED',
        recoverable: false,
        fieldsChanged: this.safeFieldNames(entity, partialComparison.suspiciousFields),
        blockers: proof?.verified ? ['SNAPSHOT_INCOMPLETE'] : ['BLOCKCHAIN_PROOF_FAILED', 'SNAPSHOT_INCOMPLETE'],
        dependencies: [], recoveryMode: 'PITR_REQUIRED',
        message: proof?.verified
          ? 'Dữ liệu hiện tại lệch ở các trường đã được audit cũ xác nhận, nhưng snapshot không đủ để khôi phục tự động.'
          : 'Dữ liệu lệch và audit nguồn cũ chưa xác minh được với blockchain.',
      };
    }

    const sourceSnapshot = verification.decryptedAfter as Snapshot;
    const effectiveSnapshot = this.effectiveRecoverySnapshot(entity, sourceSnapshot, liveSnapshot);
    const comparison = this.snapshotsEqual(effectiveSnapshot, liveSnapshot)
      ? { ok: true, suspiciousFields: [] as string[] }
      : compareLiveSnapshotToAuditAfter(row, liveSnapshot);
    if (comparison.ok) return null;

    if (row.onChainStatus !== 'ANCHORED' || row.batchId == null) {
      return {
        ...base,
        status: 'AUDIT_UNTRUSTED',
        recoverable: false,
        fieldsChanged: this.safeFieldNames(entity, comparison.suspiciousFields),
        blockers: ['LATEST_AUDIT_NOT_ANCHORED'], dependencies: [], recoveryMode: 'AUDIT_BATCH_FIRST',
        message: 'Dữ liệu lệch với audit mới nhất nhưng audit này chưa được neo. Mọi sửa/xóa bị chặn cho đến khi xác minh và neo batch.',
      };
    }

    const proof = row.seq == null ? null : await this.anchor.getInclusionProof(row.seq);
    if (!proof?.verified) {
      return {
        ...base,
        status: 'AUDIT_UNTRUSTED',
        recoverable: false,
        fieldsChanged: this.safeFieldNames(entity, comparison.suspiciousFields),
        blockers: ['BLOCKCHAIN_PROOF_FAILED'], dependencies: [], recoveryMode: 'AUDIT_BATCH_FIRST',
        message: 'Dữ liệu lệch nhưng audit nguồn chưa xác minh được với blockchain. Hãy kiểm tra batch trước.',
      };
    }

    return {
      ...base,
      status: 'TAMPERED',
      recoverable: true,
      fieldsChanged: this.safeFieldNames(entity, comparison.suspiciousFields),
      blockers: [], dependencies: [], recoveryMode: 'DIRECT_ENTITY',
      message: 'Dữ liệu hiện tại không khớp bản audit đã được blockchain xác nhận. Mọi sửa/xóa đã bị chặn.',
    };
  }

  private findLatestAnchoredRow(entity: RecoverableAuditEntity, entityId: string) {
    return this.prisma.blockchainLogger.findFirst({
      where: {
        entity,
        entityId,
        seq: { not: null },
        batchId: { not: null },
        onChainStatus: 'ANCHORED',
      },
      orderBy: { seq: 'desc' },
    });
  }

  private async findLatestCompleteAnchoredRow(entity: RecoverableAuditEntity, entityId: string) {
    const rows = await this.prisma.blockchainLogger.findMany({
      where: {
        entity,
        entityId,
        seq: { not: null },
        batchId: { not: null },
        onChainStatus: 'ANCHORED',
      },
      orderBy: { seq: 'desc' },
      take: 50,
    });
    for (const row of rows) {
      const verification = verifyAuditRow(row);
      if (!verification.ok) continue;
      if (this.hasCompleteSnapshot(entity, verification.decryptedAfter)) return row;
    }
    return null;
  }

  private findLatestRow(entity: RecoverableAuditEntity, entityId: string) {
    return this.prisma.blockchainLogger.findFirst({
      where: { entity, entityId, seq: { not: null } },
      orderBy: { seq: 'desc' },
    });
  }

  /**
   * Kiểm tra xem entity có từng bị xóa vĩnh viễn có chủ ý bởi admin hay không.
   * Tìm row AdministrativeDeletion/PERMANENT_DELETE có entityId khớp trong audit log.
   * Nếu có → entity đã gone intentionally, không phải mất trái phép → không cảnh báo, không recreate.
   */
  private async isIntentionallyDeleted(entityId: string): Promise<boolean> {
    const row = await this.prisma.blockchainLogger.findFirst({
      where: {
        entity: 'AdministrativeDeletion',
        entityId,
        action: 'PERMANENT_DELETE',
        seq: { not: null },
      },
      select: { id: true },
    });
    return row !== null;
  }

  private async loadLiveSnapshot(client: DbClient, entity: RecoverableAuditEntity, entityId: string): Promise<Snapshot | null> {
    if (entity === 'Patient') {
      const row = await client.patient.findUnique({ where: { id: entityId } });
      return row ? buildPatientSnapshot(row) : null;
    }
    if (entity === 'Department') {
      const row = await client.department.findUnique({ where: { id: entityId } });
      return row ? buildDepartmentSnapshot(row) : null;
    }
    if (entity === 'StaffProfile') {
      const row = await client.staffProfile.findUnique({ where: { id: entityId }, include: { user: true } });
      return row ? buildStaffSnapshot(row) : null;
    }
    if (entity === 'DoctorProfile') {
      const row = await client.doctorProfile.findUnique({
        where: { id: entityId },
        include: { staffProfile: { include: { user: true } } },
      });
      return row ? buildUnifiedDoctorSnapshot(row) : null;
    }
    if (entity === 'AiModelRegistry') {
      const row = await client.aiModelRegistry.findUnique({ where: { id: entityId } });
      return row ? buildAiModelSnapshot(row) : null;
    }
    if (entity === 'Visit') {
      const row = await client.visit.findUnique({ where: { id: entityId } });
      return row ? buildVisitSnapshot(row) : null;
    }
    if (entity === 'AiDiagnosis') {
      const row = await client.aiDiagnosis.findUnique({ where: { id: entityId } });
      return row ? (buildAiDiagnosisSnapshot(row) as Snapshot) : null;
    }
    if (entity === 'MedicalOrder') {
      const row = await client.medicalOrder.findUnique({ where: { id: entityId } });
      return row ? (buildMedicalOrderSnapshot(row) as Snapshot) : null;
    }
    if (entity === 'MedicalResult') {
      const row = await client.medicalResult.findUnique({
        where: { id: entityId },
        include: { files: true, order: { select: { visitId: true, status: true } } },
      });
      if (!row) return null;
      return buildMedicalResultSnapshot(row);
    }
    if (entity === 'Appointment') {
      const row = await client.appointment.findUnique({
        where: { id: entityId },
        include: { doctor: { select: { staffProfileId: true } } },
      });
      return row ? (buildAppointmentSnapshot(row) as Snapshot) : null;
    }
    if (entity === 'AiQuality') {
      const row = await client.aiQuality.findUnique({ where: { id: entityId } });
      return row ? (buildAiQualitySnapshot(row) as Snapshot) : null;
    }
    const row = await client.medicalConclusion.findUnique({
      where: { id: entityId },
      include: { visit: { include: { patient: true } } },
    });
    return row ? (buildMedicalConclusionSnapshot(row) as Snapshot) : null;
  }

  private async restoreSnapshot(client: Prisma.TransactionClient, entity: RecoverableAuditEntity, entityId: string, snapshot: Snapshot) {
    if (entity === 'Patient') {
      await client.patient.update({ where: { id: entityId }, data: {
        patientCode: this.string(snapshot, 'patientCode'), fullName: this.string(snapshot, 'fullName'),
        gender: this.string(snapshot, 'gender'), birthDate: this.date(snapshot, 'birthDate'),
        citizenId: this.nullableString(snapshot, 'citizenId'), phone: this.nullableString(snapshot, 'phone'),
        address: this.nullableString(snapshot, 'address'), insuranceNumber: this.nullableString(snapshot, 'insuranceNumber'),
        emergencyContact: this.nullableString(snapshot, 'emergencyContact'),
      } });
      return;
    }
    if (entity === 'Department') {
      const managerId = this.nullableString(snapshot, 'managerId');
      if (managerId) await this.requireRelation(client.staffProfile.findUnique({ where: { id: managerId }, select: { id: true } }), 'nhân sự quản lý');
      await client.department.update({ where: { id: entityId }, data: {
        departmentCode: this.string(snapshot, 'departmentCode'), name: this.string(snapshot, 'name'),
        floor: this.nullableString(snapshot, 'floor'), status: this.enumValue(snapshot, 'status', OperationalStatus),
        type: this.enumValue(snapshot, 'type', DepartmentType), canReceiveOrders: this.boolean(snapshot, 'canReceiveOrders'),
        description: this.nullableString(snapshot, 'description'), managerId,
      } });
      return;
    }
    if (entity === 'StaffProfile') {
      const departmentId = this.nullableString(snapshot, 'departmentId');
      if (departmentId) await this.requireRelation(client.department.findUnique({ where: { id: departmentId }, select: { id: true } }), 'phòng ban');
      const current = await client.staffProfile.findUniqueOrThrow({ where: { id: entityId }, select: { userId: true } });
      await client.staffProfile.update({ where: { id: entityId }, data: this.staffData(snapshot, departmentId) });
      await client.user.update({ where: { id: current.userId }, data: { status: this.enumValue(snapshot, 'status', UserStatus) } });
      return;
    }
    if (entity === 'DoctorProfile') {
      const departmentId = this.nullableString(snapshot, 'departmentId');
      if (departmentId) await this.requireRelation(client.department.findUnique({ where: { id: departmentId }, select: { id: true } }), 'phòng ban');
      const doctor = await client.doctorProfile.findUniqueOrThrow({ where: { id: entityId }, select: { staffProfileId: true, staffProfile: { select: { userId: true } } } });
      if (doctor.staffProfileId !== this.string(snapshot, 'staffProfileId')) throw new ConflictException('Snapshot bác sĩ không khớp hồ sơ nhân sự hiện tại.');
      await client.staffProfile.update({ where: { id: doctor.staffProfileId }, data: this.staffData(snapshot, departmentId) });
      await client.user.update({ where: { id: doctor.staffProfile.userId }, data: { status: this.enumValue(snapshot, 'status', UserStatus) } });
      await client.doctorProfile.update({ where: { id: entityId }, data: {
        specialty: this.enumValue(snapshot, 'specialty', MedicalSpecialty),
        licenseNumber: this.string(snapshot, 'licenseNumber'), qualification: this.string(snapshot, 'qualification'),
        yearsExperience: this.nullableNumber(snapshot, 'yearsExperience'),
      } });
      return;
    }
    if (entity === 'AiModelRegistry') {
      const createdBy = this.string(snapshot, 'createdBy');
      await this.requireRelation(client.user.findUnique({ where: { id: createdBy }, select: { id: true } }), 'người tạo mô hình');
      const status = this.enumValue(snapshot, 'status', OperationalStatus);
      await client.aiModelRegistry.update({ where: { id: entityId }, data: {
        modelName: this.string(snapshot, 'modelName'), modelVersion: this.string(snapshot, 'modelVersion'),
        recommendedSpecialty: this.nullableString(snapshot, 'recommendedSpecialty'), type: this.nullableString(snapshot, 'type'),
        provider: this.nullableString(snapshot, 'provider'), apiEndpoint: this.nullableString(snapshot, 'apiEndpoint'),
        ipHashPlain: this.nullableString(snapshot, 'ipHashPlain'), description: this.nullableString(snapshot, 'description'),
        status, isDeleted: status === OperationalStatus.DELETE || snapshot.isDeleted === true, createdBy,
      } });
      return;
    }
    if (entity === 'Visit') {
      const patientId = this.string(snapshot, 'patientId');
      const departmentId = this.string(snapshot, 'departmentId');
      const staffId = this.nullableString(snapshot, 'staffId');
      await this.requireRelation(client.patient.findUnique({ where: { id: patientId }, select: { id: true } }), 'bệnh nhân');
      await this.requireRelation(client.department.findUnique({ where: { id: departmentId }, select: { id: true } }), 'phòng ban');
      if (staffId) await this.requireRelation(client.staffProfile.findUnique({ where: { id: staffId }, select: { id: true } }), 'nhân sự phụ trách');
      await client.visit.update({ where: { id: entityId }, data: {
        visitCode: this.string(snapshot, 'visitCode'), patientId, departmentId, staffId,
        status: this.enumValue(snapshot, 'status', VisitStatus), source: this.enumValue(snapshot, 'source', VisitSource),
        checkInAt: this.date(snapshot, 'checkInAt'), completedAt: this.nullableDate(snapshot, 'completedAt'),
      } });
      return;
    }
    if (entity === 'AiDiagnosis') {
      const aiModelId = this.string(snapshot, 'aiModelId');
      const patientId = this.nullableString(snapshot, 'patientId');
      const visitId = this.nullableString(snapshot, 'visitId');
      const reviewedByDoctorId = this.nullableString(snapshot, 'reviewedByDoctorId');
      await this.requireRelation(client.aiModelRegistry.findUnique({ where: { id: aiModelId }, select: { id: true } }), 'mô hình AI');
      if (patientId) await this.requireRelation(client.patient.findUnique({ where: { id: patientId }, select: { id: true } }), 'bệnh nhân');
      if (visitId) await this.requireRelation(client.visit.findUnique({ where: { id: visitId }, select: { id: true } }), 'lượt khám');
      if (reviewedByDoctorId) await this.requireRelation(client.doctorProfile.findUnique({ where: { id: reviewedByDoctorId }, select: { id: true } }), 'bác sĩ đánh giá');
      await client.aiDiagnosis.update({ where: { id: entityId }, data: {
        aiModelId, patientId, visitId,
        prompt: this.nullableString(snapshot, 'prompt'), result: this.nullableString(snapshot, 'result'),
        confidence: this.nullableNumber(snapshot, 'confidence'), status: this.string(snapshot, 'status'),
        reviewedByDoctorId, doctorFeedback: this.nullableString(snapshot, 'doctorFeedback'),
      } });
      return;
    }

    if (entity === 'MedicalOrder') {
      const visitId = this.string(snapshot, 'visitId');
      const patientId = this.string(snapshot, 'patientId');
      const doctorId = this.string(snapshot, 'doctorId');
      const targetDepartmentId = this.nullableString(snapshot, 'targetDepartmentId');
      await this.requireRelation(client.visit.findUnique({ where: { id: visitId }, select: { id: true } }), 'lượt khám');
      await this.requireRelation(client.patient.findUnique({ where: { id: patientId }, select: { id: true } }), 'bệnh nhân');
      await this.requireRelation(client.doctorProfile.findUnique({ where: { id: doctorId }, select: { id: true } }), 'bác sĩ');
      if (targetDepartmentId) await this.requireRelation(client.department.findUnique({ where: { id: targetDepartmentId }, select: { id: true } }), 'phòng ban đích');
      await client.medicalOrder.update({ where: { id: entityId }, data: {
        orderCode: this.string(snapshot, 'orderCode'), visitId, patientId, doctorId, targetDepartmentId,
        orderType: this.string(snapshot, 'orderType'), priority: this.string(snapshot, 'priority'),
        status: this.enumValue(snapshot, 'status', MedicalOrderStatus),
        clinicalNote: this.nullableString(snapshot, 'clinicalNote'),
      } });
      return;
    }
    if (entity === 'MedicalResult') {
      const orderId = this.string(snapshot, 'orderId');
      const performedById = this.nullableString(snapshot, 'performedById');
      await this.requireRelation(client.medicalOrder.findUnique({ where: { id: orderId }, select: { id: true } }), 'chỉ định');
      if (performedById) await this.requireRelation(client.user.findUnique({ where: { id: performedById }, select: { id: true } }), 'người thực hiện');
      await client.medicalResult.update({ where: { id: entityId }, data: {
        resultCode: this.string(snapshot, 'resultCode'), orderId, performedById,
        note: this.nullableString(snapshot, 'note'),
        returnedAt: this.nullableDate(snapshot, 'returnedAt') ?? new Date(),
      } });
      // Files của kết quả xét nghiệm cực kỳ nhạy cảm — phải khớp 100% snapshot.
      const files = this.resultFiles(snapshot);
      await client.medicalResultFile.deleteMany({ where: { resultId: entityId } });
      if (files.length > 0) {
        await client.medicalResultFile.createMany({ data: files.map((file) => ({ ...file, resultId: entityId })) });
      }
      return;
    }
    if (entity === 'Appointment') {
      const patientId = this.string(snapshot, 'patientId');
      const departmentId = this.string(snapshot, 'departmentId');
      const doctorId = this.nullableString(snapshot, 'doctorId');
      await this.requireRelation(client.patient.findUnique({ where: { id: patientId }, select: { id: true } }), 'bệnh nhân');
      await this.requireRelation(client.department.findUnique({ where: { id: departmentId }, select: { id: true } }), 'phòng ban');
      if (doctorId) await this.requireRelation(client.doctorProfile.findUnique({ where: { id: doctorId }, select: { id: true } }), 'bác sĩ');
      // qrTokenHash không nằm trong snapshot (tạo mới khi recreate); khi restore giữ nguyên hash đang khớp blockchain.
      const current = await client.appointment.findUniqueOrThrow({ where: { id: entityId }, select: { qrTokenHash: true, qrExpiresAt: true } });
      await client.appointment.update({ where: { id: entityId }, data: {
        appointmentCode: this.string(snapshot, 'appointmentCode'), patientId, departmentId, doctorId,
        scheduledAt: this.date(snapshot, 'scheduledAt'),
        status: this.enumValue(snapshot, 'status', AppointmentStatus),
        qrTokenHash: current.qrTokenHash, qrExpiresAt: current.qrExpiresAt,
      } });
      return;
    }
    if (entity === 'AiQuality') {
      const doctorId = this.string(snapshot, 'doctorId');
      const aiModelId = this.string(snapshot, 'aiModelId');
      const aiDiagnosisId = this.nullableString(snapshot, 'aiDiagnosisId');
      await this.requireRelation(client.doctorProfile.findUnique({ where: { id: doctorId }, select: { id: true } }), 'bác sĩ');
      await this.requireRelation(client.aiModelRegistry.findUnique({ where: { id: aiModelId }, select: { id: true } }), 'mô hình AI');
      if (aiDiagnosisId) await this.requireRelation(client.aiDiagnosis.findUnique({ where: { id: aiDiagnosisId }, select: { id: true } }), 'chẩn đoán AI');
      await client.aiQuality.update({ where: { id: entityId }, data: {
        doctorId, aiModelId, aiDiagnosisId,
        doctorConclusionAboutModel: this.string(snapshot, 'doctorConclusionAboutModel'),
        trustablePercent: this.number(snapshot, 'trustablePercent'),
      } });
      return;
    }

    const visitId = this.string(snapshot, 'visitId');
    const doctorId = this.string(snapshot, 'doctorId');
    const aiDiagnosisId = this.nullableString(snapshot, 'aiDiagnosisId');
    const visit = await client.visit.findUnique({ where: { id: visitId }, select: { patient: { select: { patientCode: true } } } });
    if (!visit || visit.patient.patientCode !== this.nullableString(snapshot, 'patientCode')) throw new ConflictException('Quan hệ lượt khám/bệnh nhân không khớp snapshot nguồn.');
    await this.requireRelation(client.doctorProfile.findUnique({ where: { id: doctorId }, select: { id: true } }), 'bác sĩ');
    if (aiDiagnosisId) await this.requireRelation(client.aiDiagnosis.findUnique({ where: { id: aiDiagnosisId }, select: { id: true } }), 'chẩn đoán AI');
    await client.medicalConclusion.update({ where: { id: entityId }, data: {
      visitId, doctorId, aiDiagnosisId, finalDiagnosis: this.string(snapshot, 'finalDiagnosis'),
      treatmentPlan: this.nullableString(snapshot, 'treatmentPlan'), prescription: this.nullableString(snapshot, 'prescription'),
      followUpNote: this.nullableString(snapshot, 'followUpNote'), doctorNote: this.nullableString(snapshot, 'doctorNote'),
    } });
  }

  private updateIntegrityHash(client: Prisma.TransactionClient, entity: RecoverableAuditEntity, entityId: string, hash256: string, dataSalt: string) {
    const data = { hash256, dataSalt };
    if (entity === 'Patient') return client.patient.update({ where: { id: entityId }, data });
    if (entity === 'Department') return client.department.update({ where: { id: entityId }, data });
    if (entity === 'StaffProfile') return client.staffProfile.update({ where: { id: entityId }, data });
    if (entity === 'DoctorProfile') return client.doctorProfile.update({ where: { id: entityId }, data });
    if (entity === 'AiModelRegistry') return client.aiModelRegistry.update({ where: { id: entityId }, data });
    if (entity === 'Visit') return Promise.resolve(null);
    if (entity === 'AiDiagnosis') return Promise.resolve(null);
    if (entity === 'MedicalOrder') return Promise.resolve(null);
    if (entity === 'MedicalResult') return Promise.resolve(null);
    if (entity === 'Appointment') return Promise.resolve(null);
    if (entity === 'AiQuality') return client.aiQuality.update({ where: { id: entityId }, data });
    return client.medicalConclusion.update({ where: { id: entityId }, data });
  }

  private staffData(snapshot: Snapshot, departmentId: string | null) {
    return {
      employeeCode: this.string(snapshot, 'employeeCode'), fullName: this.string(snapshot, 'fullName'),
      phone: this.string(snapshot, 'phone'), gender: this.string(snapshot, 'gender'), citizenId: this.string(snapshot, 'citizenId'),
      birthDate: this.date(snapshot, 'birthDate'), address: this.nullableString(snapshot, 'address'),
      avatarUrl: this.string(snapshot, 'avatarUrl'), departmentId, position: this.nullableString(snapshot, 'position'),
    };
  }

  private requireCompleteSnapshot(entity: RecoverableAuditEntity, value: unknown): Snapshot {
    if (!this.hasCompleteSnapshot(entity, value)) throw new ConflictException('Snapshot audit không đủ trường bắt buộc để khôi phục an toàn.');
    return value;
  }

  private hasCompleteSnapshot(entity: RecoverableAuditEntity, value: unknown): value is Snapshot {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    return REQUIRED_SNAPSHOT_FIELDS[entity].every((field) => Object.prototype.hasOwnProperty.call(value, field));
  }

  /**
   * Early Staff/Doctor CREATE audits were produced before the related User was
   * loaded, so their otherwise valid encrypted snapshot contains status=null.
   * User status cannot be reconstructed from that snapshot. Preserve the live
   * status and recover every other trusted field instead of reporting a false
   * tamper warning or trying to write null into the UserStatus enum.
   */
  private effectiveRecoverySnapshot(entity: RecoverableAuditEntity, source: Snapshot, live: Snapshot): Snapshot {
    if ((entity === 'StaffProfile' || entity === 'DoctorProfile') && source.status == null) {
      return { ...source, status: live.status };
    }
    return source;
  }

  private snapshotsEqual(left: Snapshot, right: Snapshot): boolean {
    return canonicalize(left) === canonicalize(right);
  }

  private compareCommittedSnapshotFields(
    entity: RecoverableAuditEntity,
    source: unknown,
    live: Snapshot,
  ): { ok: boolean; suspiciousFields: string[] } {
    if (!source || typeof source !== 'object' || Array.isArray(source)) {
      return { ok: false, suspiciousFields: [] };
    }

    const snapshot = source as Snapshot;
    const committedFields = REQUIRED_SNAPSHOT_FIELDS[entity].filter((field) =>
      Object.prototype.hasOwnProperty.call(snapshot, field),
    );
    const suspiciousFields = committedFields.filter(
      (field) => canonicalize(snapshot[field]) !== canonicalize(live[field]),
    );
    return { ok: suspiciousFields.length === 0, suspiciousFields };
  }

  private safeFieldNames(entity: RecoverableAuditEntity, fields: string[]): string[] {
    const sensitive = SENSITIVE_FIELDS[entity];
    const result = new Set<string>();
    for (const field of fields) result.add(sensitive?.has(field) ? 'SENSITIVE_FIELD_CHANGED' : field);
    return [...result];
  }

  private isRecoverableEntity(entity: string): entity is RecoverableAuditEntity {
    return (RECOVERABLE_AUDIT_ENTITIES as readonly string[]).includes(entity);
  }

  private targetKey(entity: RecoverableAuditEntity, entityId: string) { return `${entity}:${entityId}`; }

  private string(snapshot: Snapshot, field: string): string {
    const value = snapshot[field];
    if (typeof value !== 'string' || !value.trim()) throw new ConflictException(`Snapshot thiếu trường bắt buộc: ${field}.`);
    return value;
  }

  private nullableString(snapshot: Snapshot, field: string): string | null {
    const value = snapshot[field];
    if (value == null || value === '') return null;
    if (typeof value !== 'string') throw new ConflictException(`Snapshot có kiểu dữ liệu không hợp lệ: ${field}.`);
    return value;
  }

  private nullableNumber(snapshot: Snapshot, field: string): number | null {
    const value = snapshot[field];
    if (value == null) return null;
    if (typeof value !== 'number' || !Number.isFinite(value)) throw new ConflictException(`Snapshot có số không hợp lệ: ${field}.`);
    return value;
  }

  private number(snapshot: Snapshot, field: string): number {
    const value = snapshot[field];
    if (typeof value !== 'number' || !Number.isFinite(value)) throw new ConflictException(`Snapshot có số không hợp lệ: ${field}.`);
    return value;
  }

  private resultFiles(snapshot: Snapshot): Array<{
    fileName: string;
    originalName: string;
    mimeType: string;
    size: number;
    url: string | null;
    storageProvider: string;
    bucket: string | null;
    objectKey: string | null;
    sha256: string | null;
    etag: string | null;
  }> {
    const files = snapshot.files;
    if (!Array.isArray(files)) throw new ConflictException('Snapshot thiếu danh sách files của kết quả xét nghiệm.');
    return files.map((file, index) => {
      if (!file || typeof file !== 'object' || Array.isArray(file)) throw new ConflictException(`File kết quả #${index + 1} không hợp lệ.`);
      const entry = file as Record<string, unknown>;
      const fileName = typeof entry.fileName === 'string' && entry.fileName ? entry.fileName : `file-${index + 1}`;
      const originalName = typeof entry.originalName === 'string' && entry.originalName ? entry.originalName : fileName;
      const mimeType = typeof entry.mimeType === 'string' && entry.mimeType ? entry.mimeType : 'application/octet-stream';
      const size = typeof entry.size === 'number' && Number.isFinite(entry.size) ? entry.size : 0;
      const storageProvider = typeof entry.storageProvider === 'string' && entry.storageProvider ? entry.storageProvider : 'CLOUDINARY';
      return {
        fileName,
        originalName,
        mimeType,
        size,
        url: typeof entry.url === 'string' ? entry.url : null,
        storageProvider,
        bucket: typeof entry.bucket === 'string' ? entry.bucket : null,
        objectKey: typeof entry.objectKey === 'string' ? entry.objectKey : null,
        sha256: typeof entry.sha256 === 'string' ? entry.sha256 : null,
        etag: typeof entry.etag === 'string' ? entry.etag : null,
      };
    });
  }

  private boolean(snapshot: Snapshot, field: string): boolean {
    const value = snapshot[field];
    if (typeof value !== 'boolean') throw new ConflictException(`Snapshot có boolean không hợp lệ: ${field}.`);
    return value;
  }

  private date(snapshot: Snapshot, field: string): Date {
    const value = snapshot[field];
    const date = typeof value === 'string' || value instanceof Date ? new Date(value) : null;
    if (!date || Number.isNaN(date.getTime())) throw new ConflictException(`Snapshot có ngày không hợp lệ: ${field}.`);
    return date;
  }

  private nullableDate(snapshot: Snapshot, field: string): Date | null {
    if (snapshot[field] == null) return null;
    return this.date(snapshot, field);
  }

  private enumValue<T extends Record<string, string>>(snapshot: Snapshot, field: string, values: T): T[keyof T] {
    const value = snapshot[field];
    if (typeof value !== 'string' || !Object.values(values).includes(value)) throw new ConflictException(`Snapshot có enum không hợp lệ: ${field}.`);
    return value as T[keyof T];
  }

  private async requireRelation<T>(promise: Promise<T | null>, label: string): Promise<T> {
    const relation = await promise;
    if (!relation) throw new ConflictException(`Không tìm thấy ${label} được tham chiếu trong snapshot.`);
    return relation;
  }

  private safeErrorMessage(error: unknown): string {
    if (error instanceof ConflictException) {
      const response = error.getResponse();
      if (typeof response === 'string') return response;
      if (response && typeof response === 'object' && 'message' in response) return String(response.message);
    }
    return 'Không thể khôi phục entity. Kiểm tra audit batch và các quan hệ liên quan.';
  }
}
