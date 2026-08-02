import { ConflictException, Injectable } from '@nestjs/common';
import {
  DepartmentType,
  LabSpecialty,
  MedicalSpecialty,
  OperationalStatus,
  Prisma,
  UserRole,
  UserStatus,
  VisitSource,
  VisitStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLoggerService } from './audit-logger.service';
import { AuditRecoveryService, VerifiedAuditRecoveryBundle } from './audit-recovery.service';
import { AuditRecoveryBundleRow } from './audit-artifact.service';
import { verifyAuditRow } from './audit-verification.util';
import { canonicalize } from './audit-hash.util';
import { buildPatientSnapshot } from '../../modules/patient/domain/patient-snapshot';
import { buildDepartmentSnapshot } from '../../modules/department/domain/department-snapshot';
import { buildStaffSnapshot } from '../../modules/staff/domain/staff-snapshot';
import { buildUnifiedDoctorSnapshot } from '../../modules/doctor/domain/doctor-snapshot';
import { buildAiModelSnapshot } from '../../modules/ai-model/domain/ai-model-snapshot';
import { buildMedicalConclusionSnapshot } from '../../modules/clinical-decision/domain/medical-conclusion-snapshot';
import { buildAiDiagnosisSnapshot } from '../../modules/clinical-decision/domain/ai-diagnosis-snapshot';
import { buildVisitSnapshot } from '../../modules/visit/domain/visit-snapshot';

export const RECREATABLE_AUDIT_ENTITIES = [
  'Patient',
  'Department',
  'StaffProfile',
  'DoctorProfile',
  'AiModelRegistry',
  'Visit',
  'MedicalConclusion',
  'AiDiagnosis',
] as const;

export type RecreatableAuditEntity = (typeof RECREATABLE_AUDIT_ENTITIES)[number];
export interface EntityRecreationTarget { entity: RecreatableAuditEntity; entityId: string }
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
  entity: RecreatableAuditEntity;
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
}

const REQUIRED_FIELDS: Record<RecreatableAuditEntity, readonly string[]> = {
  Patient: ['patientCode', 'fullName', 'gender', 'birthDate', 'citizenId', 'phone', 'address', 'insuranceNumber', 'emergencyContact'],
  Department: ['departmentCode', 'name', 'floor', 'status', 'type', 'canReceiveOrders', 'description', 'managerId'],
  StaffProfile: ['employeeCode', 'fullName', 'phone', 'gender', 'citizenId', 'birthDate', 'address', 'avatarUrl', 'departmentId', 'position', 'status'],
  DoctorProfile: ['employeeCode', 'fullName', 'phone', 'gender', 'citizenId', 'birthDate', 'address', 'avatarUrl', 'departmentId', 'position', 'status', 'staffProfileId', 'specialty', 'licenseNumber', 'qualification', 'yearsExperience'],
  AiModelRegistry: ['modelName', 'modelVersion', 'recommendedSpecialty', 'type', 'provider', 'apiEndpoint', 'ipHashPlain', 'description', 'status', 'createdBy'],
  Visit: ['visitCode', 'patientId', 'departmentId', 'staffId', 'status', 'source', 'checkInAt', 'completedAt'],
  MedicalConclusion: ['visitId', 'patientCode', 'doctorId', 'aiDiagnosisId', 'finalDiagnosis', 'treatmentPlan', 'prescription', 'followUpNote', 'doctorNote'],
  AiDiagnosis: ['aiModelId', 'patientId', 'visitId', 'prompt', 'result', 'confidence', 'status', 'reviewedByDoctorId', 'doctorFeedback'],
};

@Injectable()
export class EntityRecreationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLoggerService,
    private readonly recovery: AuditRecoveryService,
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
    if (await this.exists(this.prisma, target)) {
      return {
        ...target, state: 'EXISTS', operation: 'NONE', recoverable: false,
        sourceSeq: null, sourceBatchId: null, source: null,
        blockers: ['ENTITY_ALREADY_EXISTS'], dependencies: [], recoveryMode: 'DIRECT_ENTITY', sensitiveDataHidden: true,
      };
    }

    try {
      const source = await this.resolveTrustedSource(target, cache);
      const snapshot = this.normalizeForRecreation(target.entity, source.snapshot);
      const blockers = await this.inspectBlockers(this.prisma, target, snapshot);
      const dependencyResult = await this.resolveRecoverableDependencies(target, snapshot, blockers, cache);
      return {
        ...target,
        state: 'MISSING',
        operation: 'RECREATE',
        recoverable: dependencyResult.blockers.length === 0,
        sourceSeq: source.sourceSeq,
        sourceBatchId: source.sourceBatchId,
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
      if (!(await this.exists(this.prisma, dependency))) {
        await this.recreateWithDependencies(dependency, actorId, `${reason} [dependency for ${key}]`, cache, nextAncestry);
      }
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`audit-entity-recreate:${target.entity}:${target.entityId}`}))`;
      if (await this.exists(tx, target)) throw new ConflictException('Entity đã xuất hiện lại trong lúc khôi phục.');
      const concurrentBlockers = await this.inspectBlockers(tx, target, snapshot);
      if (concurrentBlockers.length) throw new ConflictException(`Không thể khôi phục entity: ${concurrentBlockers.join(', ')}.`);

      await this.createSnapshot(tx, target, snapshot);
      const restored = await this.loadSnapshot(tx, target);
      if (!restored || canonicalize(restored) !== canonicalize(this.businessSnapshot(snapshot))) {
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
    const batches = await this.prisma.auditBatch.findMany({
      where: { status: 'ANCHORED', artifactHash: { not: null }, artifactUri: { not: null } },
      orderBy: [{ toSeq: 'desc' }, { batchId: 'desc' }],
      select: { batchId: true },
    });
    if (!batches.length) throw new ConflictException('Không có audit artifact đã neo trên blockchain để khôi phục.');

    for (const batch of batches) {
      let verified: VerifiedAuditRecoveryBundle;
      try {
        let pending = cache.get(batch.batchId);
        if (!pending) {
          pending = this.recovery.loadVerifiedBundle(batch.batchId);
          cache.set(batch.batchId, pending);
        }
        verified = await pending;
      } catch {
        throw new ConflictException(`Audit artifact batch ${batch.batchId} không xác minh được; dừng để tránh dùng snapshot cũ hơn.`);
      }

      const rows = [...verified.logs].sort((left, right) => right.seq - left.seq);
      for (const row of rows) {
        const snapshot = this.snapshotFromRow(row, target);
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

  private snapshotFromRow(row: AuditRecoveryBundleRow, target: EntityRecreationTarget): Snapshot | null {
    if (row.entityId !== target.entityId) return null;
    const verification = verifyAuditRow({ ...row, createdAt: new Date(row.createdAt) });
    if (!verification.ok) return null;

    if (row.entity === 'AdministrativeDeletion') {
      const before = this.asObject(verification.decryptedBefore);
      const envelope = before ? this.recoveryEnvelope(before) : null;
      if (!before || envelope?.targetEntity !== target.entity) return null;
      return this.hasCompleteSnapshot(target.entity, before) ? before : null;
    }
    if (row.entity !== target.entity) return null;

    const after = this.asObject(verification.decryptedAfter);
    const before = this.asObject(verification.decryptedBefore);
    const candidate = after ?? before;
    return candidate && this.hasCompleteSnapshot(target.entity, candidate) ? candidate : null;
  }

  private normalizeForRecreation(entity: RecreatableAuditEntity, source: Snapshot): Snapshot {
    const snapshot = { ...source };
    if (entity === 'Department' && snapshot.status === OperationalStatus.DELETE) snapshot.status = OperationalStatus.INACTIVE;
    if ((entity === 'StaffProfile' || entity === 'DoctorProfile') && snapshot.status === UserStatus.DELETE) snapshot.status = UserStatus.INACTIVE;
    if (entity === 'AiModelRegistry' && snapshot.status === OperationalStatus.DELETE) snapshot.status = OperationalStatus.INACTIVE;
    if (entity === 'AiModelRegistry') delete snapshot.isDeleted;
    return snapshot;
  }

  private async resolveRecoverableDependencies(
    target: EntityRecreationTarget,
    snapshot: Snapshot,
    blockers: string[],
    cache: EntityRecreationBundleCache,
  ): Promise<{ blockers: string[]; dependencies: EntityRecreationTarget[] }> {
    if (!blockers.includes('MISSING_VISIT') || (target.entity !== 'MedicalConclusion' && target.entity !== 'AiDiagnosis')) {
      return { blockers, dependencies: [] };
    }
    const visitId = this.nullableString(snapshot, 'visitId');
    if (!visitId) return { blockers, dependencies: [] };
    const dependency: EntityRecreationTarget = { entity: 'Visit', entityId: visitId };
    const preview = await this.previewOne(dependency, cache);
    if (!preview.recoverable) {
      return {
        blockers: blockers.map((blocker) => blocker === 'MISSING_VISIT' ? 'MISSING_VISIT_NOT_RECOVERABLE' : blocker),
        dependencies: [],
      };
    }
    return {
      blockers: blockers.filter((blocker) => blocker !== 'MISSING_VISIT'),
      dependencies: [dependency],
    };
  }

  private async inspectBlockers(client: DbClient, target: EntityRecreationTarget, snapshot: Snapshot): Promise<string[]> {
    const blockers: string[] = [];
    const add = (value: string) => { if (!blockers.includes(value)) blockers.push(value); };

    if (target.entity === 'Patient') {
      const duplicate = await client.patient.findFirst({
        where: { OR: [
          { patientCode: this.string(snapshot, 'patientCode') },
          ...(this.nullableString(snapshot, 'citizenId') ? [{ citizenId: this.nullableString(snapshot, 'citizenId')! }] : []),
        ] }, select: { id: true },
      });
      if (duplicate && duplicate.id !== target.entityId) add('PATIENT_UNIQUE_CONFLICT');
    }

    if (target.entity === 'Department') {
      const duplicate = await client.department.findFirst({
        where: { OR: [{ departmentCode: this.string(snapshot, 'departmentCode') }, { name: this.string(snapshot, 'name') }] },
        select: { id: true },
      });
      if (duplicate && duplicate.id !== target.entityId) add('DEPARTMENT_UNIQUE_CONFLICT');
      const managerId = this.nullableString(snapshot, 'managerId');
      if (managerId && !(await client.staffProfile.findUnique({ where: { id: managerId }, select: { id: true } }))) add('MISSING_DEPARTMENT_MANAGER');
    }

    if (target.entity === 'StaffProfile' || target.entity === 'DoctorProfile') {
      const departmentId = this.nullableString(snapshot, 'departmentId');
      if (departmentId && !(await client.department.findUnique({ where: { id: departmentId }, select: { id: true } }))) add('MISSING_DEPARTMENT');
      const profileId = target.entity === 'DoctorProfile' ? this.string(snapshot, 'staffProfileId') : target.entityId;
      const existingStaff = await client.staffProfile.findUnique({ where: { id: profileId }, select: { id: true, userId: true } });
      if (!existingStaff) {
        const envelope = this.recoveryEnvelope(snapshot);
        if (!envelope?.user || !envelope.staff) add('MISSING_ENCRYPTED_USER_BACKUP');
        else await this.inspectUserBlockers(client, envelope.user, profileId, add);

        const staffDuplicate = await client.staffProfile.findFirst({
          where: { OR: [
            { employeeCode: this.string(snapshot, 'employeeCode') },
            { citizenId: this.string(snapshot, 'citizenId') },
          ] }, select: { id: true },
        });
        if (staffDuplicate && staffDuplicate.id !== profileId) add('STAFF_UNIQUE_CONFLICT');
      }
      if (target.entity === 'DoctorProfile') {
        const doctorDuplicate = await client.doctorProfile.findFirst({
          where: { OR: [
            { staffProfileId: profileId },
            { licenseNumber: this.string(snapshot, 'licenseNumber') },
          ] }, select: { id: true },
        });
        if (doctorDuplicate && doctorDuplicate.id !== target.entityId) add('DOCTOR_UNIQUE_CONFLICT');
      }
    }

    if (target.entity === 'AiModelRegistry') {
      const createdBy = this.string(snapshot, 'createdBy');
      if (!(await client.user.findUnique({ where: { id: createdBy }, select: { id: true } }))) add('MISSING_AI_MODEL_CREATOR');
      const details = this.recoveryEnvelope(snapshot)?.entity;
      if (!details || typeof details.modelId !== 'string' || typeof details.ipHashEncrypted !== 'string') add('MISSING_ENCRYPTED_AI_MODEL_BACKUP');
      else {
        const duplicate = await client.aiModelRegistry.findUnique({ where: { modelId: details.modelId }, select: { id: true } });
        if (duplicate && duplicate.id !== target.entityId) add('AI_MODEL_UNIQUE_CONFLICT');
      }
    }

    if (target.entity === 'Visit') {
      const duplicate = await client.visit.findUnique({ where: { visitCode: this.string(snapshot, 'visitCode') }, select: { id: true } });
      if (duplicate && duplicate.id !== target.entityId) add('VISIT_CODE_UNIQUE_CONFLICT');
      const patientId = this.string(snapshot, 'patientId');
      if (!(await client.patient.findUnique({ where: { id: patientId }, select: { id: true } }))) add('MISSING_PATIENT');
      const departmentId = this.string(snapshot, 'departmentId');
      if (!(await client.department.findUnique({ where: { id: departmentId }, select: { id: true } }))) add('MISSING_DEPARTMENT');
      const staffId = this.nullableString(snapshot, 'staffId');
      if (staffId && !(await client.staffProfile.findUnique({ where: { id: staffId }, select: { id: true } }))) add('MISSING_VISIT_STAFF');
    }

    if (target.entity === 'AiDiagnosis') {
      const aiModelId = this.string(snapshot, 'aiModelId');
      if (!(await client.aiModelRegistry.findUnique({ where: { id: aiModelId }, select: { id: true } }))) add('MISSING_AI_MODEL');
      const patientId = this.nullableString(snapshot, 'patientId');
      if (patientId && !(await client.patient.findUnique({ where: { id: patientId }, select: { id: true } }))) add('MISSING_PATIENT');
      const visitId = this.nullableString(snapshot, 'visitId');
      if (visitId) {
        const visit = await client.visit.findUnique({ where: { id: visitId }, select: { id: true, patientId: true } });
        if (!visit) add('MISSING_VISIT');
        else if (patientId && visit.patientId !== patientId) add('VISIT_PATIENT_MISMATCH');
      }
      const reviewerId = this.nullableString(snapshot, 'reviewedByDoctorId');
      if (reviewerId && !(await client.doctorProfile.findUnique({ where: { id: reviewerId }, select: { id: true } }))) add('MISSING_REVIEWING_DOCTOR');
    }

    if (target.entity === 'MedicalConclusion') {
      const visitId = this.string(snapshot, 'visitId');
      const visit = await client.visit.findUnique({
        where: { id: visitId },
        select: { id: true, patient: { select: { patientCode: true } }, finalConclusion: { select: { id: true } } },
      });
      if (!visit) add('MISSING_VISIT');
      else {
        if (visit.patient.patientCode !== this.nullableString(snapshot, 'patientCode')) add('VISIT_PATIENT_MISMATCH');
        if (visit.finalConclusion && visit.finalConclusion.id !== target.entityId) add('VISIT_ALREADY_HAS_CONCLUSION');
      }
      const doctorId = this.string(snapshot, 'doctorId');
      if (!(await client.doctorProfile.findUnique({ where: { id: doctorId }, select: { id: true } }))) add('MISSING_DOCTOR');
      const diagnosisId = this.nullableString(snapshot, 'aiDiagnosisId');
      if (diagnosisId) {
        const diagnosis = await client.aiDiagnosis.findUnique({ where: { id: diagnosisId }, select: { id: true, visitId: true } });
        if (!diagnosis) add('MISSING_AI_DIAGNOSIS');
        else if (diagnosis.visitId !== visitId) add('DIAGNOSIS_VISIT_MISMATCH');
      }
    }

    return blockers;
  }

  private async inspectUserBlockers(client: DbClient, user: Snapshot, profileId: string, add: (value: string) => void) {
    const userId = this.string(user, 'id');
    const existing = await client.user.findUnique({
      where: { id: userId },
      select: { id: true, staffProfile: { select: { id: true } } },
    });
    if (existing) {
      if (existing.staffProfile && existing.staffProfile.id !== profileId) add('USER_ALREADY_HAS_STAFF_PROFILE');
      return;
    }
    const filters: Prisma.UserWhereInput[] = [];
    const username = this.nullableString(user, 'username');
    const email = this.nullableString(user, 'email');
    const phoneNormalized = this.nullableString(user, 'phoneNormalized');
    if (username) filters.push({ username });
    if (email) filters.push({ email });
    if (phoneNormalized) filters.push({ phoneNormalized });
    if (filters.length && await client.user.findFirst({ where: { OR: filters }, select: { id: true } })) add('USER_UNIQUE_CONFLICT');
  }

  private async createSnapshot(client: Prisma.TransactionClient, target: EntityRecreationTarget, snapshot: Snapshot) {
    const business = this.businessSnapshot(snapshot);
    const integrity = target.entity === 'AiDiagnosis' || target.entity === 'Visit' ? null : this.audit.hashSnapshot(business);

    if (target.entity === 'Patient') {
      await client.patient.create({ data: {
        id: target.entityId, patientCode: this.string(snapshot, 'patientCode'), fullName: this.string(snapshot, 'fullName'),
        gender: this.string(snapshot, 'gender'), birthDate: this.date(snapshot, 'birthDate'), citizenId: this.nullableString(snapshot, 'citizenId'),
        phone: this.nullableString(snapshot, 'phone'), address: this.nullableString(snapshot, 'address'),
        insuranceNumber: this.nullableString(snapshot, 'insuranceNumber'), emergencyContact: this.nullableString(snapshot, 'emergencyContact'),
        hash256: integrity!.hash, dataSalt: integrity!.salt,
      } });
      return;
    }
    if (target.entity === 'Department') {
      await client.department.create({ data: {
        id: target.entityId, departmentCode: this.string(snapshot, 'departmentCode'), name: this.string(snapshot, 'name'),
        floor: this.nullableString(snapshot, 'floor'), status: this.enumValue(snapshot, 'status', OperationalStatus),
        type: this.enumValue(snapshot, 'type', DepartmentType), canReceiveOrders: this.boolean(snapshot, 'canReceiveOrders'),
        description: this.nullableString(snapshot, 'description'), managerId: this.nullableString(snapshot, 'managerId'),
        hash256: integrity!.hash, dataSalt: integrity!.salt, deletedAt: null, deletedBy: null, restoredAt: new Date(),
      } });
      return;
    }
    if (target.entity === 'StaffProfile') {
      const envelope = this.requireRecoveryEnvelope(snapshot);
      const userId = await this.ensureUser(client, envelope.user, null, target.entityId);
      await client.staffProfile.create({ data: {
        id: target.entityId, userId, ...this.staffCreateData(snapshot, envelope.staff),
        hash256: integrity!.hash, dataSalt: integrity!.salt,
      } });
      return;
    }
    if (target.entity === 'DoctorProfile') {
      const staffProfileId = this.string(snapshot, 'staffProfileId');
      let staff = await client.staffProfile.findUnique({ where: { id: staffProfileId }, select: { id: true } });
      if (!staff) {
        const envelope = this.requireRecoveryEnvelope(snapshot);
        const userId = await this.ensureUser(client, envelope.user, UserRole.DOCTOR, staffProfileId);
        staff = await client.staffProfile.create({ data: {
          id: staffProfileId, userId, ...this.staffCreateData(snapshot, envelope.staff),
        }, select: { id: true } });
      }
      await client.doctorProfile.create({ data: {
        id: target.entityId, staffProfileId: staff.id,
        specialty: this.enumValue(snapshot, 'specialty', MedicalSpecialty), licenseNumber: this.string(snapshot, 'licenseNumber'),
        qualification: this.string(snapshot, 'qualification'), yearsExperience: this.nullableNumber(snapshot, 'yearsExperience'),
        hash256: integrity!.hash, dataSalt: integrity!.salt,
      } });
      return;
    }
    if (target.entity === 'AiModelRegistry') {
      const details = this.requireRecoveryEnvelope(snapshot).entity;
      await client.aiModelRegistry.create({ data: {
        id: target.entityId, modelId: this.string(details, 'modelId'), modelName: this.string(snapshot, 'modelName'),
        modelVersion: this.string(snapshot, 'modelVersion'), recommendedSpecialty: this.nullableString(snapshot, 'recommendedSpecialty'),
        ipHashEncrypted: this.string(details, 'ipHashEncrypted'), ipHashPlain: this.nullableString(snapshot, 'ipHashPlain'),
        apiEndpoint: this.nullableString(snapshot, 'apiEndpoint'), provider: this.nullableString(snapshot, 'provider'),
        isActiveOnChain: this.optionalBoolean(details, 'isActiveOnChain', false), description: this.nullableString(snapshot, 'description'),
        createdBy: this.string(snapshot, 'createdBy'), type: this.nullableString(snapshot, 'type'),
        status: this.enumValue(snapshot, 'status', OperationalStatus), isDeleted: false,
        hash256: integrity!.hash, dataSalt: integrity!.salt, deletedAt: null, deletedBy: null, restoredAt: new Date(),
      } });
      return;
    }
    if (target.entity === 'Visit') {
      await client.visit.create({ data: {
        id: target.entityId,
        visitCode: this.string(snapshot, 'visitCode'),
        patientId: this.string(snapshot, 'patientId'),
        departmentId: this.string(snapshot, 'departmentId'),
        staffId: this.nullableString(snapshot, 'staffId'),
        status: this.enumValue(snapshot, 'status', VisitStatus),
        source: this.enumValue(snapshot, 'source', VisitSource),
        checkInAt: this.date(snapshot, 'checkInAt'),
        completedAt: this.nullableDate(snapshot, 'completedAt'),
      } });
      return;
    }
    if (target.entity === 'AiDiagnosis') {
      await client.aiDiagnosis.create({ data: {
        id: target.entityId, aiModelId: this.string(snapshot, 'aiModelId'), patientId: this.nullableString(snapshot, 'patientId'),
        visitId: this.nullableString(snapshot, 'visitId'), prompt: this.nullableString(snapshot, 'prompt'),
        result: this.nullableString(snapshot, 'result'), confidence: this.nullableNumber(snapshot, 'confidence'),
        status: this.string(snapshot, 'status'), reviewedByDoctorId: this.nullableString(snapshot, 'reviewedByDoctorId'),
        doctorFeedback: this.nullableString(snapshot, 'doctorFeedback'),
      } });
      return;
    }
    await client.medicalConclusion.create({ data: {
      id: target.entityId, visitId: this.string(snapshot, 'visitId'), doctorId: this.string(snapshot, 'doctorId'),
      aiDiagnosisId: this.nullableString(snapshot, 'aiDiagnosisId'), finalDiagnosis: this.string(snapshot, 'finalDiagnosis'),
      treatmentPlan: this.nullableString(snapshot, 'treatmentPlan'), prescription: this.nullableString(snapshot, 'prescription'),
      followUpNote: this.nullableString(snapshot, 'followUpNote'), doctorNote: this.nullableString(snapshot, 'doctorNote'),
      hash256: integrity!.hash, dataSalt: integrity!.salt,
    } });
  }

  private async ensureUser(
    client: Prisma.TransactionClient,
    value: Snapshot | undefined,
    expectedRole: UserRole | null,
    profileId: string,
  ): Promise<string> {
    if (!value) throw new ConflictException('Snapshot không có bản sao tài khoản đã mã hóa.');
    const id = this.string(value, 'id');
    const existing = await client.user.findUnique({
      where: { id },
      select: { id: true, role: true, staffProfile: { select: { id: true } } },
    });
    if (existing) {
      if (expectedRole ? existing.role !== expectedRole : !this.isStaffRole(existing.role)) {
        throw new ConflictException('Vai trò tài khoản hiện tại không khớp snapshot phục hồi.');
      }
      if (existing.staffProfile && existing.staffProfile.id !== profileId) {
        throw new ConflictException('Tài khoản hiện tại đã liên kết với hồ sơ nhân sự khác.');
      }
      await client.user.update({
        where: { id },
        data: {
          status: UserStatus.INACTIVE,
          deletedAt: null,
          deletedBy: null,
          restoredAt: new Date(),
          tokenVersion: { increment: 1 },
        },
      });
      return existing.id;
    }
    const role = this.enumValue(value, 'role', UserRole);
    if (expectedRole ? role !== expectedRole : !this.isStaffRole(role)) {
      throw new ConflictException('Vai trò tài khoản trong snapshot không hợp lệ với entity.');
    }
    await client.user.create({ data: {
      id,
      username: this.nullableString(value, 'username'), email: this.nullableString(value, 'email'),
      phone: this.nullableString(value, 'phone'), phoneNormalized: this.nullableString(value, 'phoneNormalized'),
      passwordHash: this.nullableString(value, 'passwordHash'), role, status: UserStatus.INACTIVE,
      firstLogin: this.optionalBoolean(value, 'firstLogin', true), registrationStep: this.optionalNumber(value, 'registrationStep', 1),
      tokenVersion: this.optionalNumber(value, 'tokenVersion', 0) + 1, inviteToken: null, inviteTokenExpiry: null,
      faceEmbedding: this.nullableString(value, 'faceEmbedding'), faceHash: this.nullableString(value, 'faceHash'),
      faceModelVersion: this.nullableString(value, 'faceModelVersion'), faceEnrolledAt: this.nullableDate(value, 'faceEnrolledAt'),
      faceSampleCount: this.nullableNumber(value, 'faceSampleCount'), faceChallenge: null, faceChallengeExpiresAt: null,
      failedFaceAttempts: 0, faceLockedUntil: null, deletedAt: null, deletedBy: null, restoredAt: new Date(),
    } });
    return id;
  }

  private staffCreateData(snapshot: Snapshot, details: Snapshot | undefined) {
    return {
      employeeCode: this.string(snapshot, 'employeeCode'), fullName: this.string(snapshot, 'fullName'),
      phone: this.string(snapshot, 'phone'), gender: this.string(snapshot, 'gender'), citizenId: this.string(snapshot, 'citizenId'),
      birthDate: this.date(snapshot, 'birthDate'), address: this.nullableString(snapshot, 'address'), avatarUrl: this.string(snapshot, 'avatarUrl'),
      departmentId: this.nullableString(snapshot, 'departmentId'), position: this.nullableString(snapshot, 'position'),
      labSpecialty: details?.labSpecialty == null ? null : this.enumValue(details, 'labSpecialty', LabSpecialty),
    };
  }

  private isStaffRole(role: UserRole): boolean {
    return role === UserRole.RECEPTIONIST || role === UserRole.LAB_MANAGER;
  }

  private async loadSnapshot(client: DbClient, target: EntityRecreationTarget): Promise<Snapshot | null> {
    if (target.entity === 'Patient') {
      const row = await client.patient.findUnique({ where: { id: target.entityId } });
      return row ? buildPatientSnapshot(row) : null;
    }
    if (target.entity === 'Department') {
      const row = await client.department.findUnique({ where: { id: target.entityId } });
      return row ? buildDepartmentSnapshot(row) : null;
    }
    if (target.entity === 'StaffProfile') {
      const row = await client.staffProfile.findUnique({ where: { id: target.entityId }, include: { user: true } });
      return row ? buildStaffSnapshot(row) : null;
    }
    if (target.entity === 'DoctorProfile') {
      const row = await client.doctorProfile.findUnique({ where: { id: target.entityId }, include: { staffProfile: { include: { user: true } } } });
      return row ? buildUnifiedDoctorSnapshot(row) : null;
    }
    if (target.entity === 'AiModelRegistry') {
      const row = await client.aiModelRegistry.findUnique({ where: { id: target.entityId } });
      return row ? buildAiModelSnapshot(row) : null;
    }
    if (target.entity === 'Visit') {
      const row = await client.visit.findUnique({ where: { id: target.entityId } });
      return row ? buildVisitSnapshot(row) : null;
    }
    if (target.entity === 'AiDiagnosis') {
      const row = await client.aiDiagnosis.findUnique({ where: { id: target.entityId } });
      return row ? buildAiDiagnosisSnapshot(row) as Snapshot : null;
    }
    const row = await client.medicalConclusion.findUnique({ where: { id: target.entityId }, include: { visit: { include: { patient: true } } } });
    return row ? buildMedicalConclusionSnapshot(row) as Snapshot : null;
  }

  private exists(client: DbClient, target: EntityRecreationTarget): Promise<unknown> {
    if (target.entity === 'Patient') return client.patient.findUnique({ where: { id: target.entityId }, select: { id: true } });
    if (target.entity === 'Department') return client.department.findUnique({ where: { id: target.entityId }, select: { id: true } });
    if (target.entity === 'StaffProfile') return client.staffProfile.findUnique({ where: { id: target.entityId }, select: { id: true } });
    if (target.entity === 'DoctorProfile') return client.doctorProfile.findUnique({ where: { id: target.entityId }, select: { id: true } });
    if (target.entity === 'AiModelRegistry') return client.aiModelRegistry.findUnique({ where: { id: target.entityId }, select: { id: true } });
    if (target.entity === 'Visit') return client.visit.findUnique({ where: { id: target.entityId }, select: { id: true } });
    if (target.entity === 'AiDiagnosis') return client.aiDiagnosis.findUnique({ where: { id: target.entityId }, select: { id: true } });
    return client.medicalConclusion.findUnique({ where: { id: target.entityId }, select: { id: true } });
  }

  private businessSnapshot(snapshot: Snapshot): Snapshot {
    const { _recovery: _ignored, ...business } = snapshot;
    return business;
  }

  private recoveryEnvelope(snapshot: Snapshot): { targetEntity?: string; user?: Snapshot; staff?: Snapshot; entity?: Snapshot } | null {
    const value = this.asObject(snapshot._recovery);
    if (!value || value.schema !== 'KLTN_ENTITY_RECOVERY_V1') return null;
    return {
      targetEntity: typeof value.targetEntity === 'string' ? value.targetEntity : undefined,
      user: this.asObject(value.user) ?? undefined,
      staff: this.asObject(value.staff) ?? undefined,
      entity: this.asObject(value.entity) ?? undefined,
    };
  }

  private requireRecoveryEnvelope(snapshot: Snapshot) {
    const envelope = this.recoveryEnvelope(snapshot);
    if (!envelope) throw new ConflictException('Snapshot không có recovery envelope đã mã hóa.');
    return envelope;
  }

  private hasCompleteSnapshot(entity: RecreatableAuditEntity, value: Snapshot): boolean {
    return REQUIRED_FIELDS[entity].every((field) => Object.prototype.hasOwnProperty.call(value, field));
  }

  private uniqueTargets(targets: EntityRecreationTarget[]) {
    return [...new Map(targets.map((target) => [`${target.entity}:${target.entityId}`, target])).values()];
  }

  private asObject(value: unknown): Snapshot | null {
    return value && typeof value === 'object' && !Array.isArray(value) ? value as Snapshot : null;
  }

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

  private optionalNumber(snapshot: Snapshot, field: string, fallback: number): number {
    return this.nullableNumber(snapshot, field) ?? fallback;
  }

  private boolean(snapshot: Snapshot, field: string): boolean {
    const value = snapshot[field];
    if (typeof value !== 'boolean') throw new ConflictException(`Snapshot có boolean không hợp lệ: ${field}.`);
    return value;
  }

  private optionalBoolean(snapshot: Snapshot, field: string, fallback: boolean): boolean {
    const value = snapshot[field];
    if (value == null) return fallback;
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
    const value = snapshot[field];
    if (value == null) return null;
    return this.date(snapshot, field);
  }

  private enumValue<T extends Record<string, string>>(snapshot: Snapshot, field: string, values: T): T[keyof T] {
    const value = snapshot[field];
    if (typeof value !== 'string' || !Object.values(values).includes(value)) throw new ConflictException(`Snapshot có enum không hợp lệ: ${field}.`);
    return value as T[keyof T];
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
