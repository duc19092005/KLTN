import { ConflictException, Injectable, forwardRef, Inject, Optional } from '@nestjs/common';
import { Prisma, OperationalStatus, UserStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLoggerService } from '../logging/audit-logger.service';
import { AuditRecoveryService, VerifiedAuditRecoveryBundle } from './audit-recovery.service';
import { AuditRecoveryBundleRow } from '../ipfs/audit-artifact.service';
import { verifyAuditRow } from '../logging/audit-verification.util';
import { canonicalize } from '../crypto/audit-hash.util';
import {
  EntityRecreationTarget,
  createEntitySnapshotData,
  loadRecreationSnapshot,
  entityRecordExists,
  businessSnapshot,
  recoveryEnvelope,
  parseString,
  parseNullableString,
} from './entity-recreation-factory';
import {
  REQUIRED_SNAPSHOT_FIELDS,
  RecoverableAuditEntity,
} from './entity-registry.config';

export type RecreatableAuditEntity = RecoverableAuditEntity;

type Snapshot = Record<string, unknown>;
type DbClient = PrismaService | Prisma.TransactionClient;
export type EntityRecreationBundleCache = Map<number, Promise<VerifiedAuditRecoveryBundle>>;

interface TrustedEntitySource {
  snapshot: Snapshot;
  sourceSeq: number;
  sourceBatchId: number;
  artifactHash: string;
}

export interface EntityRecreationPreview {
  entity: RecoverableAuditEntity;
  entityId: string;
  state: 'MISSING' | 'EXISTS';
  operation: 'RECREATE' | 'NONE';
  recoverable: boolean;
  sourceSeq: number | null;
  sourceBatchId: number | null;
  source: 'IPFS_BLOCKCHAIN_VERIFIED' | null;
  blockers: string[];
  dependencies: EntityRecreationTarget[];
  recoveryMode: 'DIRECT_ENTITY' | 'DEPENDENCY_CHAIN' | 'PITR_REQUIRED';
  sensitiveDataHidden: true;
  autoResolvable?: boolean;
  message?: string;
}

/**
 * EntityRecreationService orchestrates recreating deleted entities by restoring
 * their complete cryptographic state from IPFS and re-establishing dependencies.
 */
@Injectable()
export class EntityRecreationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLoggerService,
    @Optional()
    @Inject(forwardRef(() => AuditRecoveryService))
    private readonly recovery?: AuditRecoveryService,
  ) {}

  createBundleCache(): EntityRecreationBundleCache {
    return new Map();
  }

  async previewMany(targets: EntityRecreationTarget[]) {
    const unique = this.uniqueTargets(targets);
    const cache = this.createBundleCache();
    const items: EntityRecreationPreview[] = [];
    for (const target of unique) items.push(await this.previewOne(target, cache));
    return { items, total: items.length, recoverable: items.filter((item) => item.recoverable).length };
  }

  async previewOne(target: EntityRecreationTarget, cache: EntityRecreationBundleCache = new Map()): Promise<EntityRecreationPreview> {
    if (await entityRecordExists(this.prisma, target)) {
      return {
        ...target, state: 'EXISTS', operation: 'NONE', recoverable: false,
        sourceSeq: null, sourceBatchId: null, source: null,
        blockers: ['ENTITY_ALREADY_EXISTS'], dependencies: [], recoveryMode: 'DIRECT_ENTITY', sensitiveDataHidden: true,
      };
    }

    try {
      const localRow = this.prisma?.blockchainLogger?.findFirst
        ? await this.prisma.blockchainLogger.findFirst({
            where: {
              entity: { in: [target.entity, 'AdministrativeDeletion'] },
              entityId: target.entityId,
              batchId: { not: null },
              onChainStatus: 'ANCHORED',
            },
            orderBy: { seq: 'desc' },
          }).catch(() => null)
        : null;

      let snapshot: Snapshot | null = null;
      let sourceSeq: number | null = null;
      let sourceBatchId: number | null = null;

      if (localRow) {
        const snapshotFromLocal = this.snapshotFromRow(localRow as any, target);
        if (snapshotFromLocal) {
          snapshot = this.normalizeForRecreation(target.entity, snapshotFromLocal);
          sourceSeq = localRow.seq;
          sourceBatchId = localRow.batchId;
        }
      }

      if (!snapshot) {
        const source = await this.resolveTrustedSource(target, cache);
        snapshot = this.normalizeForRecreation(target.entity, source.snapshot);
        sourceSeq = source.sourceSeq;
        sourceBatchId = source.sourceBatchId;
      }

      const blockers = await this.inspectBlockers(this.prisma, target, snapshot);
      const dependencyResult = await this.resolveRecoverableDependencies(target, snapshot, blockers, cache);
      return {
        ...target,
        state: 'MISSING',
        operation: 'RECREATE',
        recoverable: dependencyResult.blockers.length === 0,
        sourceSeq,
        sourceBatchId,
        source: 'IPFS_BLOCKCHAIN_VERIFIED',
        blockers: dependencyResult.blockers,
        dependencies: dependencyResult.dependencies,
        recoveryMode: dependencyResult.dependencies.length ? 'DEPENDENCY_CHAIN' : 'DIRECT_ENTITY',
        sensitiveDataHidden: true,
      };
    } catch (error) {
      return {
        ...target, state: 'MISSING', operation: 'RECREATE', recoverable: false,
        sourceSeq: null, sourceBatchId: null, source: null,
        blockers: [this.safeErrorMessage(error)], dependencies: [], recoveryMode: 'PITR_REQUIRED', sensitiveDataHidden: true,
      };
    }
  }

  async recreate(
    target: EntityRecreationTarget,
    actorId: string,
    reason: string,
    cache: EntityRecreationBundleCache = new Map(),
  ) {
    return this.recreateWithDependencies(target, actorId, reason, cache, new Set());
  }

  private async recreateWithDependencies(
    target: EntityRecreationTarget,
    actorId: string,
    reason: string,
    cache: EntityRecreationBundleCache,
    ancestry: Set<string>,
  ) {
    const key = `${target.entity}:${target.entityId}`;
    if (ancestry.has(key)) throw new ConflictException('Phát hiện vòng lặp khóa ngoại trong chuỗi phục hồi.');
    const nextAncestry = new Set(ancestry).add(key);
    const source = await this.resolveTrustedSource(target, cache);
    const snapshot = this.normalizeForRecreation(target.entity, source.snapshot);
    const blockers = await this.inspectBlockers(this.prisma, target, snapshot);
    const dependencyResult = await this.resolveRecoverableDependencies(target, snapshot, blockers, cache);
    if (dependencyResult.blockers.length) {
      throw new ConflictException(`Không thể khôi phục entity: ${dependencyResult.blockers.join(', ')}.`);
    }
    for (const dependency of dependencyResult.dependencies) {
      if (!(await entityRecordExists(this.prisma, dependency))) {
        await this.recreateWithDependencies(dependency, actorId, `${reason} [dependency for ${key}]`, cache, nextAncestry);
      }
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`audit-entity-recreate:${target.entity}:${target.entityId}`}))`;
      if (await entityRecordExists(tx, target)) throw new ConflictException('Entity đã xuất hiện lại trong lúc khôi phục.');
      const concurrentBlockers = await this.inspectBlockers(tx, target, snapshot);
      if (concurrentBlockers.length) throw new ConflictException(`Không thể khôi phục entity: ${concurrentBlockers.join(', ')}.`);

      await createEntitySnapshotData(tx, target, snapshot);
      const restored = await loadRecreationSnapshot(tx, target);
      if (!restored || canonicalize(restored) !== canonicalize(businessSnapshot(snapshot))) {
        throw new ConflictException('Entity sau khi tạo lại không khớp snapshot audit đã xác minh.');
      }

      await this.audit.recordV2({
        entity: target.entity,
        entityId: target.entityId,
        action: 'AUDIT_ENTITY_RECREATED_FROM_IPFS',
        actorId,
        before: null,
        after: restored,
        metadata: {
          reason,
          sourceSeq: source.sourceSeq,
          sourceBatchId: source.sourceBatchId,
          sourceArtifactHash: source.artifactHash,
        },
      }, tx);
    });

    return {
      ...target,
      status: 'RECREATED' as const,
      source: 'IPFS_BLOCKCHAIN_VERIFIED' as const,
      sourceSeq: source.sourceSeq,
      batchId: source.sourceBatchId,
    };
  }

  private async resolveTrustedSource(target: EntityRecreationTarget, cache: EntityRecreationBundleCache): Promise<TrustedEntitySource> {
    const localRow = this.prisma?.blockchainLogger?.findFirst
      ? await this.prisma.blockchainLogger.findFirst({
          where: {
            entity: { in: [target.entity, 'AdministrativeDeletion'] },
            entityId: target.entityId,
            batchId: { not: null },
            onChainStatus: 'ANCHORED',
          },
          orderBy: { seq: 'desc' },
          select: { batchId: true },
        }).catch(() => null)
      : null;

    if (localRow?.batchId && this.prisma?.auditBatch?.findUnique) {
      const batch = await this.prisma.auditBatch.findUnique({
        where: { batchId: localRow.batchId },
        select: { batchId: true, status: true, artifactHash: true, artifactUri: true },
      }).catch(() => null);
      if (batch && batch.status === 'ANCHORED' && batch.artifactHash && batch.artifactUri) {
        try {
          let pending = cache.get(batch.batchId);
          if (!pending) {
            pending = this.recovery!.loadVerifiedBundle(batch.batchId);
            cache.set(batch.batchId, pending);
          }
          const verified = await pending;
          const rows = [...verified.logs].sort((left, right) => right.seq - left.seq);
          for (const row of rows) {
            const snapshot = this.snapshotFromRow(row, target, verified.logs);
            if (snapshot) {
              return {
                snapshot,
                sourceSeq: row.seq,
                sourceBatchId: batch.batchId,
                artifactHash: verified.artifactHash,
              };
            }
          }
        } catch {
          // fallback to scan
        }
      }
    }

    const batches = this.prisma?.auditBatch?.findMany
      ? await this.prisma.auditBatch.findMany({
          where: { status: 'ANCHORED', artifactHash: { not: null }, artifactUri: { not: null } },
          orderBy: [{ toSeq: 'desc' }, { batchId: 'desc' }],
          select: { batchId: true },
        }).catch(() => [])
      : [];
    if (!batches.length) throw new ConflictException('Không có audit artifact đã neo trên blockchain để khôi phục.');

    for (const batch of batches) {
      if (localRow?.batchId && batch.batchId === localRow.batchId) continue;
      let verified: VerifiedAuditRecoveryBundle;
      try {
        let pending = cache.get(batch.batchId);
        if (!pending) {
          pending = this.recovery!.loadVerifiedBundle(batch.batchId);
          cache.set(batch.batchId, pending);
        }
        verified = await pending;
      } catch {
        continue;
      }

      const rows = [...verified.logs].sort((left, right) => right.seq - left.seq);
      for (const row of rows) {
        const snapshot = this.snapshotFromRow(row, target, verified.logs);
        if (!snapshot) continue;
        return {
          snapshot,
          sourceSeq: row.seq,
          sourceBatchId: batch.batchId,
          artifactHash: verified.artifactHash,
        };
      }
    }
    throw new ConflictException('Không tìm thấy snapshot đầy đủ của entity trong các artifact IPFS đã xác minh.');
  }

  private snapshotFromRow(row: AuditRecoveryBundleRow, target: EntityRecreationTarget, bundleLogs?: AuditRecoveryBundleRow[]): Snapshot | null {
    if (row.entityId !== target.entityId) return null;
    const verification = verifyAuditRow({ ...row, createdAt: new Date(row.createdAt) });
    if (!verification.ok) return null;

    if (row.entity === 'AdministrativeDeletion') {
      const before = this.asObject(verification.decryptedBefore);
      const envelope = before ? recoveryEnvelope(before) : null;
      if (!before || envelope?.targetEntity !== target.entity) return null;
      return this.hasCompleteSnapshot(target.entity, before) ? before : null;
    }
    if (row.entity !== target.entity) return null;

    const after = this.asObject(verification.decryptedAfter);
    const before = this.asObject(verification.decryptedBefore);
    let candidate = after ?? before;

    if (candidate && !this.hasCompleteSnapshot(target.entity, candidate)) {
      candidate = this.synthesizeCompleteSnapshot(target.entity, candidate, row, bundleLogs);
    }

    return candidate && this.hasCompleteSnapshot(target.entity, candidate) ? candidate : null;
  }

  private synthesizeCompleteSnapshot(
    entity: RecoverableAuditEntity,
    candidate: Snapshot,
    row: AuditRecoveryBundleRow,
    bundleLogs?: AuditRecoveryBundleRow[],
  ): Snapshot {
    const synthesized: Snapshot = { ...candidate };

    if (bundleLogs && Array.isArray(bundleLogs)) {
      const peerRows = bundleLogs
        .filter((peer) => peer.entityId === row.entityId && peer.entity === entity)
        .sort((left, right) => left.seq - right.seq);
      for (const peer of peerRows) {
        const verification = verifyAuditRow({ ...peer, createdAt: new Date(peer.createdAt) });
        if (!verification.ok) continue;
        const peerSnapshot = this.asObject(verification.decryptedAfter)
          ?? this.asObject(verification.decryptedBefore);
        if (!peerSnapshot) continue;
        for (const [field, value] of Object.entries(peerSnapshot)) {
          if (synthesized[field] === undefined && value !== undefined) {
            synthesized[field] = value;
          }
        }
      }
    }

    if (row.diffJson && typeof row.diffJson === 'object') {
      const changes = (row.diffJson as { changes?: Array<{ field?: string; before?: unknown; after?: unknown }> }).changes;
      if (Array.isArray(changes)) {
        for (const change of changes) {
          if (!change.field || synthesized[change.field] !== undefined) continue;
          const value = change.after !== '[REDACTED]' ? change.after : change.before;
          if (value !== undefined && value !== '[REDACTED]') synthesized[change.field] = value;
        }
      }
    }

    return synthesized;
  }

  private normalizeForRecreation(entity: RecoverableAuditEntity, source: Snapshot): Snapshot {
    const snapshot = { ...source };
    if (entity === 'Department' && snapshot.status === OperationalStatus.DELETE) snapshot.status = OperationalStatus.INACTIVE;
    if ((entity === 'StaffProfile' || entity === 'DoctorProfile') && snapshot.status === UserStatus.DELETE) snapshot.status = UserStatus.INACTIVE;
    if (entity === 'AiModelRegistry' && snapshot.status === OperationalStatus.DELETE) snapshot.status = OperationalStatus.INACTIVE;
    if (entity === 'AiModelRegistry') delete snapshot.isDeleted;
    if (entity === 'MedicalResult') delete snapshot.status;
    return snapshot;
  }

  private async resolveRecoverableDependencies(
    target: EntityRecreationTarget,
    snapshot: Snapshot,
    blockers: string[],
    cache: EntityRecreationBundleCache,
  ): Promise<{ blockers: string[]; dependencies: EntityRecreationTarget[] }> {
    let currentBlockers = [...blockers];
    const dependencies: EntityRecreationTarget[] = [];

    const tryResolve = async (blockerName: string, depEntity: RecoverableAuditEntity, depId: string | null) => {
      if (!currentBlockers.includes(blockerName) || !depId) return;
      const dependency: EntityRecreationTarget = { entity: depEntity, entityId: depId };
      const preview = await this.previewOne(dependency, cache);
      if (!preview.recoverable) {
        currentBlockers = currentBlockers.map((b) => (b === blockerName ? `${blockerName}_NOT_RECOVERABLE` : b));
      } else {
        currentBlockers = currentBlockers.filter((b) => b !== blockerName);
        if (!dependencies.some((d) => d.entity === depEntity && d.entityId === depId)) {
          dependencies.push(dependency);
        }
      }
    };

    await tryResolve('MISSING_PATIENT', 'Patient', parseNullableString(snapshot, 'patientId'));
    await tryResolve('MISSING_DEPARTMENT', 'Department', parseNullableString(snapshot, 'departmentId'));
    await tryResolve('MISSING_TARGET_DEPARTMENT', 'Department', parseNullableString(snapshot, 'targetDepartmentId'));
    await tryResolve('MISSING_DEPARTMENT_MANAGER', 'StaffProfile', parseNullableString(snapshot, 'managerId'));
    await tryResolve('MISSING_VISIT_STAFF', 'StaffProfile', parseNullableString(snapshot, 'staffId'));
    await tryResolve('MISSING_DOCTOR', 'DoctorProfile', parseNullableString(snapshot, 'doctorId'));
    await tryResolve('MISSING_REVIEWING_DOCTOR', 'DoctorProfile', parseNullableString(snapshot, 'reviewedByDoctorId'));
    await tryResolve('MISSING_AI_MODEL', 'AiModelRegistry', parseNullableString(snapshot, 'aiModelId'));
    await tryResolve('MISSING_VISIT', 'Visit', parseNullableString(snapshot, 'visitId'));
    await tryResolve('MISSING_MEDICAL_ORDER', 'MedicalOrder', parseNullableString(snapshot, 'orderId'));
    await tryResolve('MISSING_AI_DIAGNOSIS', 'AiDiagnosis', parseNullableString(snapshot, 'aiDiagnosisId'));

    return { blockers: currentBlockers, dependencies };
  }

  private async inspectBlockers(client: DbClient, target: EntityRecreationTarget, snapshot: Snapshot): Promise<string[]> {
    const blockers: string[] = [];
    const add = (value: string) => { if (!blockers.includes(value)) blockers.push(value); };

    if (target.entity === 'Patient') {
      const duplicate = await client.patient.findFirst({
        where: { OR: [
          { patientCode: parseString(snapshot, 'patientCode') },
          ...(parseNullableString(snapshot, 'citizenId') ? [{ citizenId: parseNullableString(snapshot, 'citizenId')! }] : []),
        ] }, select: { id: true },
      });
      if (duplicate && duplicate.id !== target.entityId) add('PATIENT_UNIQUE_CONFLICT');
    }

    if (target.entity === 'Department') {
      const duplicate = await client.department.findFirst({
        where: { OR: [{ departmentCode: parseString(snapshot, 'departmentCode') }, { name: parseString(snapshot, 'name') }] },
        select: { id: true },
      });
      if (duplicate && duplicate.id !== target.entityId) add('DEPARTMENT_UNIQUE_CONFLICT');
      const managerId = parseNullableString(snapshot, 'managerId');
      if (managerId && !(await client.staffProfile.findUnique({ where: { id: managerId }, select: { id: true } }))) add('MISSING_DEPARTMENT_MANAGER');
    }

    if (target.entity === 'StaffProfile' || target.entity === 'DoctorProfile') {
      const departmentId = parseNullableString(snapshot, 'departmentId');
      if (departmentId && !(await client.department.findUnique({ where: { id: departmentId }, select: { id: true } }))) add('MISSING_DEPARTMENT');
      const profileId = target.entity === 'DoctorProfile' ? parseString(snapshot, 'staffProfileId') : target.entityId;
      const existingStaff = await client.staffProfile.findUnique({ where: { id: profileId }, select: { id: true, userId: true } });
      if (!existingStaff) {
        const envelope = recoveryEnvelope(snapshot);
        if (!envelope?.user || !envelope.staff) add('MISSING_ENCRYPTED_USER_BACKUP');
        else await this.inspectUserBlockers(client, envelope.user, profileId, add);

        const staffDuplicate = await client.staffProfile.findFirst({
          where: { OR: [
            { employeeCode: parseString(snapshot, 'employeeCode') },
            { citizenId: parseString(snapshot, 'citizenId') },
          ] }, select: { id: true },
        });
        if (staffDuplicate && staffDuplicate.id !== profileId) add('STAFF_UNIQUE_CONFLICT');
      }
      if (target.entity === 'DoctorProfile') {
        const doctorDuplicate = await client.doctorProfile.findFirst({
          where: { OR: [
            { staffProfileId: profileId },
            { licenseNumber: parseString(snapshot, 'licenseNumber') },
          ] }, select: { id: true },
        });
        if (doctorDuplicate && doctorDuplicate.id !== target.entityId) add('DOCTOR_UNIQUE_CONFLICT');
      }
    }

    if (target.entity === 'AiModelRegistry') {
      const createdBy = parseString(snapshot, 'createdBy');
      if (!(await client.user.findUnique({ where: { id: createdBy }, select: { id: true } }))) add('MISSING_AI_MODEL_CREATOR');
      const details = recoveryEnvelope(snapshot)?.entity;
      if (!details || typeof details.modelId !== 'string' || typeof details.ipHashEncrypted !== 'string') add('MISSING_ENCRYPTED_AI_MODEL_BACKUP');
      else {
        const duplicate = await client.aiModelRegistry.findUnique({ where: { modelId: details.modelId }, select: { id: true } });
        if (duplicate && duplicate.id !== target.entityId) add('AI_MODEL_UNIQUE_CONFLICT');
      }
    }

    if (target.entity === 'Visit') {
      const duplicate = await client.visit.findUnique({ where: { visitCode: parseString(snapshot, 'visitCode') }, select: { id: true } });
      if (duplicate && duplicate.id !== target.entityId) add('VISIT_CODE_UNIQUE_CONFLICT');
      const patientId = parseString(snapshot, 'patientId');
      if (!(await client.patient.findUnique({ where: { id: patientId }, select: { id: true } }))) add('MISSING_PATIENT');
      const departmentId = parseString(snapshot, 'departmentId');
      if (!(await client.department.findUnique({ where: { id: departmentId }, select: { id: true } }))) add('MISSING_DEPARTMENT');
      const staffId = parseNullableString(snapshot, 'staffId');
      if (staffId && !(await client.staffProfile.findUnique({ where: { id: staffId }, select: { id: true } }))) add('MISSING_VISIT_STAFF');
    }

    if (target.entity === 'AiDiagnosis') {
      const aiModelId = parseString(snapshot, 'aiModelId');
      if (!(await client.aiModelRegistry.findUnique({ where: { id: aiModelId }, select: { id: true } }))) add('MISSING_AI_MODEL');
      const patientId = parseNullableString(snapshot, 'patientId');
      if (patientId && !(await client.patient.findUnique({ where: { id: patientId }, select: { id: true } }))) add('MISSING_PATIENT');
      const visitId = parseNullableString(snapshot, 'visitId');
      if (visitId) {
        const visit = await client.visit.findUnique({ where: { id: visitId }, select: { id: true, patientId: true } });
        if (!visit) add('MISSING_VISIT');
        else if (patientId && visit.patientId !== patientId) add('VISIT_PATIENT_MISMATCH');
      }
      const reviewerId = parseNullableString(snapshot, 'reviewedByDoctorId');
      if (reviewerId && !(await client.doctorProfile.findUnique({ where: { id: reviewerId }, select: { id: true } }))) add('MISSING_REVIEWING_DOCTOR');
    }

    if (target.entity === 'MedicalConclusion') {
      const visitId = parseString(snapshot, 'visitId');
      const visit = await client.visit.findUnique({
        where: { id: visitId },
        select: { id: true, patient: { select: { patientCode: true } }, finalConclusion: { select: { id: true } } },
      });
      if (!visit) add('MISSING_VISIT');
      else {
        if (visit.patient.patientCode !== parseNullableString(snapshot, 'patientCode')) add('VISIT_PATIENT_MISMATCH');
        if (visit.finalConclusion && visit.finalConclusion.id !== target.entityId) add('VISIT_ALREADY_HAS_CONCLUSION');
      }
      const doctorId = parseString(snapshot, 'doctorId');
      if (!(await client.doctorProfile.findUnique({ where: { id: doctorId }, select: { id: true } }))) add('MISSING_DOCTOR');
      const diagnosisId = parseNullableString(snapshot, 'aiDiagnosisId');
      if (diagnosisId) {
        const diagnosis = await client.aiDiagnosis.findUnique({ where: { id: diagnosisId }, select: { id: true, visitId: true } });
        if (!diagnosis) add('MISSING_AI_DIAGNOSIS');
        else if (diagnosis.visitId !== visitId) add('DIAGNOSIS_VISIT_MISMATCH');
      }
    }

    if (target.entity === 'MedicalOrder') {
      const duplicate = await client.medicalOrder.findUnique({ where: { orderCode: parseString(snapshot, 'orderCode') }, select: { id: true } });
      if (duplicate && duplicate.id !== target.entityId) add('ORDER_CODE_UNIQUE_CONFLICT');
      const visitId = parseString(snapshot, 'visitId');
      const visit = await client.visit.findUnique({ where: { id: visitId }, select: { id: true, patientId: true } });
      if (!visit) add('MISSING_VISIT');
      else if (parseNullableString(snapshot, 'patientId') && visit.patientId !== parseNullableString(snapshot, 'patientId')) add('ORDER_VISIT_PATIENT_MISMATCH');
      const doctorId = parseString(snapshot, 'doctorId');
      if (!(await client.doctorProfile.findUnique({ where: { id: doctorId }, select: { id: true } }))) add('MISSING_DOCTOR');
      const targetDepartmentId = parseNullableString(snapshot, 'targetDepartmentId');
      if (targetDepartmentId && !(await client.department.findUnique({ where: { id: targetDepartmentId }, select: { id: true } }))) add('MISSING_TARGET_DEPARTMENT');
    }

    if (target.entity === 'MedicalResult') {
      const duplicate = await client.medicalResult.findUnique({ where: { resultCode: parseString(snapshot, 'resultCode') }, select: { id: true } });
      if (duplicate && duplicate.id !== target.entityId) add('RESULT_CODE_UNIQUE_CONFLICT');
      const orderId = parseString(snapshot, 'orderId');
      if (!(await client.medicalOrder.findUnique({ where: { id: orderId }, select: { id: true } }))) add('MISSING_MEDICAL_ORDER');
      const performedById = parseNullableString(snapshot, 'performedById');
      if (performedById && !(await client.user.findUnique({ where: { id: performedById }, select: { id: true } }))) add('MISSING_PERFORMED_BY');
    }

    if (target.entity === 'Appointment') {
      const duplicate = await client.appointment.findUnique({ where: { appointmentCode: parseString(snapshot, 'appointmentCode') }, select: { id: true } });
      if (duplicate && duplicate.id !== target.entityId) add('APPOINTMENT_CODE_UNIQUE_CONFLICT');
      const patientId = parseString(snapshot, 'patientId');
      if (!(await client.patient.findUnique({ where: { id: patientId }, select: { id: true } }))) add('MISSING_PATIENT');
      const departmentId = parseString(snapshot, 'departmentId');
      if (!(await client.department.findUnique({ where: { id: departmentId }, select: { id: true } }))) add('MISSING_DEPARTMENT');
      const doctorId = parseNullableString(snapshot, 'doctorId');
      if (doctorId && !(await client.doctorProfile.findUnique({ where: { id: doctorId }, select: { id: true } }))) add('MISSING_DOCTOR');
    }

    if (target.entity === 'AiQuality') {
      const doctorId = parseString(snapshot, 'doctorId');
      if (!(await client.doctorProfile.findUnique({ where: { id: doctorId }, select: { id: true } }))) add('MISSING_DOCTOR');
      const aiModelId = parseString(snapshot, 'aiModelId');
      if (!(await client.aiModelRegistry.findUnique({ where: { id: aiModelId }, select: { id: true } }))) add('MISSING_AI_MODEL');
      const aiDiagnosisId = parseNullableString(snapshot, 'aiDiagnosisId');
      if (aiDiagnosisId && !(await client.aiDiagnosis.findUnique({ where: { id: aiDiagnosisId }, select: { id: true } }))) add('MISSING_AI_DIAGNOSIS');
    }

    return blockers;
  }

  private async inspectUserBlockers(client: DbClient, user: Snapshot, profileId: string, add: (value: string) => void) {
    const userId = parseString(user, 'id');
    const existing = await client.user.findUnique({
      where: { id: userId },
      select: { id: true, staffProfile: { select: { id: true } } },
    });
    if (existing) {
      if (existing.staffProfile && existing.staffProfile.id !== profileId) add('USER_ALREADY_HAS_STAFF_PROFILE');
      return;
    }
    const filters: Prisma.UserWhereInput[] = [];
    const username = parseNullableString(user, 'username');
    const email = parseNullableString(user, 'email');
    const phoneNormalized = parseNullableString(user, 'phoneNormalized');
    if (username) filters.push({ username });
    if (email) filters.push({ email });
    if (phoneNormalized) filters.push({ phoneNormalized });
    if (filters.length && await client.user.findFirst({ where: { OR: filters }, select: { id: true } })) add('USER_UNIQUE_CONFLICT');
  }

  private hasCompleteSnapshot(entity: RecoverableAuditEntity, value: Snapshot): boolean {
    return REQUIRED_SNAPSHOT_FIELDS[entity].every((field) => Object.prototype.hasOwnProperty.call(value, field));
  }

  private uniqueTargets(targets: EntityRecreationTarget[]) {
    return [...new Map(targets.map((target) => [`${target.entity}:${target.entityId}`, target])).values()];
  }

  private asObject(value: unknown): Snapshot | null {
    return value && typeof value === 'object' && !Array.isArray(value) ? value as Snapshot : null;
  }

  private safeErrorMessage(error: unknown): string {
    if (error instanceof ConflictException) {
      const response = error.getResponse();
      if (typeof response === 'string') return response;
      if (response && typeof response === 'object' && 'message' in response) return String(response.message);
    }
    return 'Không thể xác minh nguồn phục hồi entity từ IPFS/blockchain.';
  }
}
