import { EntityRecreationService, RecreatableAuditEntity } from '../../../../../src/infrastructure/audit';
import { AuditRecoveryBundleRow } from '../../../../../src/infrastructure/audit';
import { AuditLoggerService } from '../../../../../src/infrastructure/audit';
import {
  AUDIT_ENTRY_V2,
  canonicalize,
  computeAfterHashV2,
  computeBeforeHashV2,
  computeDataHashV2,
  computeDiffHashV2,
  computeEntryHashV2,
  GENESIS_PREV_HASH,
} from '../../../../../src/infrastructure/audit';
import { buildAuditDiff } from '../../../../../src/infrastructure/audit';
import { buildAuditEncryptionAad, encryptAuditSnapshot } from '../../../../../src/infrastructure/audit';

type Snapshot = Record<string, any>;

const IDS = {
  entity: '11111111-1111-4111-8111-111111111111',
  user: '22222222-2222-4222-8222-222222222222',
  staff: '33333333-3333-4333-8333-333333333333',
  department: '44444444-4444-4444-8444-444444444444',
  patient: '55555555-5555-4555-8555-555555555555',
  visit: '66666666-6666-4666-8666-666666666666',
  model: '77777777-7777-4777-8777-777777777777',
  doctor: '88888888-8888-4888-8888-888888888888',
  diagnosis: '99999999-9999-4999-8999-999999999999',
};

function recoveryUser(role: string): Snapshot {
  return {
    id: IDS.user, username: `restored-${role.toLowerCase()}`, email: `${role.toLowerCase()}@example.test`,
    phone: '0900000001', phoneNormalized: '84900000001', passwordHash: '$argon2id$trusted-hash',
    role, status: 'DELETE', firstLogin: false, registrationStep: 2, tokenVersion: 7,
    faceEmbedding: null, faceHash: null, faceModelVersion: null, faceEnrolledAt: null, faceSampleCount: null,
  };
}

function envelope(targetEntity: string, extra: Snapshot = {}): Snapshot {
  return { schema: 'KLTN_ENTITY_RECOVERY_V1', targetEntity, ...extra };
}

const cases: Array<{ entity: RecreatableAuditEntity; snapshot: Snapshot }> = [
  {
    entity: 'Patient',
    snapshot: {
      patientCode: 'BN-0001', fullName: 'Nguyen Van A', gender: 'MALE', birthDate: '1990-01-01T00:00:00.000Z',
      citizenId: '001122334455', phone: '0900000000', address: 'Address', insuranceNumber: null, emergencyContact: null,
    },
  },
  {
    entity: 'Department',
    snapshot: {
      departmentCode: 'PB-01', name: 'Khoa Noi', floor: '2', status: 'DELETE', type: 'CLINICAL',
      canReceiveOrders: true, description: null, managerId: null,
      _recovery: envelope('Department', { entity: { createdAt: '2026-01-01T00:00:00.000Z' } }),
    },
  },
  {
    entity: 'StaffProfile',
    snapshot: {
      employeeCode: 'NV-0001', fullName: 'Nhan Vien A', phone: '0900000001', gender: 'MALE', citizenId: '101122334455',
      birthDate: '1995-01-01T00:00:00.000Z', address: null, avatarUrl: '/avatar.png', departmentId: null,
      position: 'Receptionist', status: 'DELETE',
      _recovery: envelope('StaffProfile', { user: recoveryUser('RECEPTIONIST'), staff: { userId: IDS.user, labSpecialty: null } }),
    },
  },
  {
    entity: 'DoctorProfile',
    snapshot: {
      employeeCode: 'BS-0001', fullName: 'Bac Si A', phone: '0900000002', gender: 'FEMALE', citizenId: '201122334455',
      birthDate: '1988-01-01T00:00:00.000Z', address: null, avatarUrl: '/doctor.png', departmentId: IDS.department,
      position: 'Doctor', status: 'DELETE', staffProfileId: IDS.staff, specialty: 'GENERAL_INTERNAL_MEDICINE', licenseNumber: 'GPH-001',
      qualification: 'CKI', yearsExperience: 8,
      _recovery: envelope('DoctorProfile', { user: recoveryUser('DOCTOR'), staff: { userId: IDS.user, labSpecialty: null } }),
    },
  },
  {
    entity: 'AiModelRegistry',
    snapshot: {
      modelName: 'Clinical AI', modelVersion: '1.0', recommendedSpecialty: null, type: 'API', provider: 'local',
      apiEndpoint: 'http://ai.test', ipHashPlain: 'plain-ip-hash', description: null, status: 'DELETE', createdBy: IDS.user,
      _recovery: envelope('AiModelRegistry', { entity: { modelId: 'model-business-id', ipHashEncrypted: 'encrypted-ip-hash', isActiveOnChain: true } }),
    },
  },
  {
    entity: 'Visit',
    snapshot: {
      visitCode: 'LK-0001', patientId: IDS.patient, departmentId: IDS.department, staffId: IDS.staff,
      status: 'IN_PROGRESS', source: 'WALK_IN', checkInAt: '2026-07-20T02:00:00.000Z', completedAt: null,
    },
  },
  {
    entity: 'AiDiagnosis',
    snapshot: {
      aiModelId: IDS.model, patientId: IDS.patient, visitId: IDS.visit, prompt: 'clinical prompt', result: '{"diagnosis":"trusted"}',
      confidence: 0.91, status: 'AI_SUGGESTED', reviewedByDoctorId: IDS.doctor, doctorFeedback: 'reviewed',
    },
  },
  {
    entity: 'MedicalConclusion',
    snapshot: {
      visitId: IDS.visit, patientCode: 'BN-0001', doctorId: IDS.doctor, aiDiagnosisId: IDS.diagnosis,
      finalDiagnosis: 'Trusted conclusion', treatmentPlan: 'Plan', prescription: null, followUpNote: null, doctorNote: 'Note',
    },
  },
  {
    entity: 'AiQuality',
    snapshot: {
      doctorId: IDS.doctor, aiModelId: IDS.model, aiDiagnosisId: IDS.diagnosis,
      doctorConclusionAboutModel: 'Very accurate', trustablePercent: 100,
    },
  },
];

function buildRow(entity: RecreatableAuditEntity, entityId: string, after: Snapshot): AuditRecoveryBundleRow {
  const createdAt = '2026-07-20T03:00:00.000Z';
  const action = 'CREATE';
  const actorId = 'admin-1';
  const diffJson = buildAuditDiff(null, after);
  const beforeHash = computeBeforeHashV2(entity, entityId, null);
  const afterHash = computeAfterHashV2(entity, entityId, after);
  const diffHash = computeDiffHashV2(diffJson);
  const dataHash = computeDataHashV2({ entity, entityId, action, beforeHash, afterHash, diffHash, fieldsChanged: diffJson.fieldsChanged });
  const entryHash = computeEntryHashV2({
    seq: 10, prevHash: GENESIS_PREV_HASH, entity, entityId, action, actorId,
    beforeHash, afterHash, diffHash, dataHash, createdAtIso: createdAt,
  });
  const aad = buildAuditEncryptionAad({ seq: 10, entity, entityId, action, createdAtIso: createdAt });
  return {
    id: 'audit-source', eventId: 'event-source', seq: 10, prevHash: GENESIS_PREV_HASH, entryHash,
    actorId, action, entity, entityId, metadata: null, dataHash, dataSalt: null,
    beforeJson: null, afterJson: null, beforeHash, afterHash, diffHash, hashVersion: AUDIT_ENTRY_V2,
    beforeEncrypted: encryptAuditSnapshot(canonicalize(null), aad),
    afterEncrypted: encryptAuditSnapshot(canonicalize(after), aad),
    encryptionVersion: 'AES-256-GCM-V1', encryptionKeyId: 'entity-recreation-test-key', diffJson, fieldsChanged: diffJson.fieldsChanged,
    departmentId: null, staffProfileId: null, doctorProfileId: null, patientId: null,
    aiModelRegistryId: null, medicalConclusionId: null, visitId: null, medicalOrderId: null, medicalResultId: null, aiQualityId: null, createdAt,
  };
}

function buildPermanentDeletionRow(entityId: string, before: Snapshot): AuditRecoveryBundleRow {
  const createdAt = '2026-07-20T04:00:00.000Z';
  const entity = 'AdministrativeDeletion';
  const action = 'PERMANENT_DELETE';
  const actorId = 'admin-1';
  const diffJson = buildAuditDiff(before, null);
  const beforeHash = computeBeforeHashV2(entity, entityId, before);
  const afterHash = computeAfterHashV2(entity, entityId, null);
  const diffHash = computeDiffHashV2(diffJson);
  const dataHash = computeDataHashV2({ entity, entityId, action, beforeHash, afterHash, diffHash, fieldsChanged: diffJson.fieldsChanged });
  const entryHash = computeEntryHashV2({
    seq: 11, prevHash: GENESIS_PREV_HASH, entity, entityId, action, actorId,
    beforeHash, afterHash, diffHash, dataHash, createdAtIso: createdAt,
  });
  const aad = buildAuditEncryptionAad({ seq: 11, entity, entityId, action, createdAtIso: createdAt });
  return {
    id: 'audit-permanent-delete', eventId: 'event-permanent-delete', seq: 11, prevHash: GENESIS_PREV_HASH, entryHash,
    actorId, action, entity, entityId, metadata: { targetEntity: before._recovery?.targetEntity }, dataHash, dataSalt: null,
    beforeJson: null, afterJson: null, beforeHash, afterHash, diffHash, hashVersion: AUDIT_ENTRY_V2,
    beforeEncrypted: encryptAuditSnapshot(canonicalize(before), aad),
    afterEncrypted: encryptAuditSnapshot(canonicalize(null), aad),
    encryptionVersion: 'AES-256-GCM-V1', encryptionKeyId: 'entity-recreation-test-key', diffJson, fieldsChanged: diffJson.fieldsChanged,
    departmentId: null, staffProfileId: null, doctorProfileId: null, patientId: null,
    aiModelRegistryId: null, medicalConclusionId: null, visitId: null, medicalOrderId: null, medicalResultId: null, aiQualityId: null, createdAt,
  };
}

function makeStore(entity: RecreatableAuditEntity, snapshot: Snapshot) {
  const records: Record<string, Map<string, any>> = {
    user: new Map(), department: new Map(), staffProfile: new Map(), doctorProfile: new Map(), patient: new Map(),
    aiModelRegistry: new Map(), aiDiagnosis: new Map(), medicalConclusion: new Map(), visit: new Map(), aiQuality: new Map(),
  };
  const targetId = IDS.entity;

  const seed = (model: string, id: string, value: any) => records[model].set(id, { id, ...value });
  if (entity === 'DoctorProfile') seed('department', IDS.department, { departmentCode: 'PB-01' });
  if (entity === 'AiModelRegistry') seed('user', IDS.user, { role: 'ADMIN', status: 'ACTIVE' });
  if (entity === 'Visit') {
    seed('patient', IDS.patient, { patientCode: 'BN-0001' });
    seed('department', IDS.department, { departmentCode: 'PB-01' });
    seed('staffProfile', IDS.staff, { employeeCode: 'NV-0001' });
  }
  if (entity === 'AiDiagnosis') {
    seed('aiModelRegistry', IDS.model, { modelId: 'model-1' });
    seed('patient', IDS.patient, { patientCode: 'BN-0001' });
    seed('visit', IDS.visit, { patientId: IDS.patient });
    seed('doctorProfile', IDS.doctor, { staffProfileId: IDS.staff });
  }
  if (entity === 'MedicalConclusion') {
    seed('patient', IDS.patient, { patientCode: 'BN-0001' });
    seed('visit', IDS.visit, { patientId: IDS.patient });
    seed('doctorProfile', IDS.doctor, { staffProfileId: IDS.staff });
    seed('aiDiagnosis', IDS.diagnosis, { visitId: IDS.visit });
  }
  if (entity === 'AiQuality') {
    seed('patient', IDS.patient, { patientCode: 'BN-0001' });
    seed('visit', IDS.visit, { patientId: IDS.patient });
    seed('doctorProfile', IDS.doctor, { staffProfileId: IDS.staff });
    seed('aiModelRegistry', IDS.model, { modelId: 'model-1' });
    seed('aiDiagnosis', IDS.diagnosis, { visitId: IDS.visit });
  }

  const hydrate = (model: string, row: any): any => {
    if (!row) return null;
    if (model === 'user') {
      const profile = [...records.staffProfile.values()].find((item) => item.userId === row.id) ?? null;
      return { ...row, staffProfile: profile ? { id: profile.id } : null };
    }
    if (model === 'staffProfile') return { ...row, user: records.user.get(row.userId) ?? null };
    if (model === 'doctorProfile') return { ...row, staffProfile: hydrate('staffProfile', records.staffProfile.get(row.staffProfileId)) };
    if (model === 'visit') {
      const conclusion = [...records.medicalConclusion.values()].find((item) => item.visitId === row.id) ?? null;
      return { ...row, patient: records.patient.get(row.patientId) ?? null, finalConclusion: conclusion };
    }
    if (model === 'medicalConclusion') return { ...row, visit: hydrate('visit', records.visit.get(row.visitId)) };
    return { ...row };
  };

  const delegates: Record<string, any> = {};
  for (const model of Object.keys(records)) {
    delegates[model] = {
      findUnique: jest.fn(async ({ where }: any) => {
        if (where.id) return hydrate(model, records[model].get(where.id));
        const [field, value] = Object.entries(where)[0] as [string, unknown];
        return hydrate(model, [...records[model].values()].find((item) => item[field] === value) ?? null);
      }),
      findFirst: jest.fn(async ({ where = {} }: any = {}) => {
        const matches = (item: any, filter: Record<string, any>) => Object.entries(filter).every(([field, value]) => {
          if (field === 'OR') return (value as Array<Record<string, any>>).some((candidate) => matches(item, candidate));
          return item[field] === value;
        });
        return hydrate(model, [...records[model].values()].find((item) => matches(item, where)) ?? null);
      }),
      create: jest.fn(async ({ data }: any) => {
        records[model].set(data.id, { ...data });
        return hydrate(model, records[model].get(data.id));
      }),
      update: jest.fn(async ({ where, data }: any) => {
        const current = records[model].get(where.id);
        const next = { ...current, ...data };
        if (data.tokenVersion && typeof data.tokenVersion.increment === 'number') {
          next.tokenVersion = (current.tokenVersion ?? 0) + data.tokenVersion.increment;
        }
        records[model].set(where.id, next);
        return hydrate(model, next);
      }),
    };
  }

  const prisma = {
    ...delegates,
    auditBatch: { findMany: jest.fn().mockResolvedValue([{ batchId: 4 }]) },
    $executeRaw: jest.fn().mockResolvedValue(1),
    $transaction: jest.fn(async (callback: (tx: any) => Promise<unknown>) => {
      const backup = Object.fromEntries(Object.entries(records).map(([model, values]) => [model, new Map(values)]));
      try {
        return await callback(prisma);
      } catch (error) {
        for (const [model, values] of Object.entries(backup)) {
          records[model].clear();
          for (const [id, value] of values as Map<string, any>) records[model].set(id, value);
        }
        throw error;
      }
    }),
  } as any;
  const sourceRow = buildRow(entity, targetId, snapshot);
  const batchRecovery = { loadVerifiedBundle: jest.fn().mockResolvedValue({
    batchId: 4, artifactHash: `0x${'a'.repeat(64)}`, artifactUri: 'ipfs://verified', merkleRoot: 'b'.repeat(64), logs: [sourceRow],
  }) };
  const realAudit = new AuditLoggerService({} as never, {} as never);
  const audit = {
    hashSnapshot: realAudit.hashSnapshot.bind(realAudit),
    recordV2: jest.fn().mockResolvedValue(undefined),
  };
  const service = new EntityRecreationService(prisma, audit as never, batchRecovery as never);
  return { service, prisma, audit, records, sourceRow, batchRecovery };
}

describe('EntityRecreationService', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.AUDIT_HASH_KEY = 'entity-recreation-hash-key-00000001';
    process.env.AUDIT_ENCRYPTION_KEY = '33'.repeat(32);
    process.env.AUDIT_ENCRYPTION_KEY_ID = 'entity-recreation-test-key';
  });

  afterAll(() => { process.env = { ...originalEnv }; });

  it.each(cases)('recreates $entity from a cryptographically valid encrypted audit snapshot', async ({ entity, snapshot }) => {
    const { service, prisma, audit, records } = makeStore(entity, snapshot);

    const result = await service.recreate({ entity, entityId: IDS.entity }, 'admin-1', 'Khôi phục entity đã xóa từ IPFS');

    expect(result).toMatchObject({ status: 'RECREATED', source: 'IPFS_BLOCKCHAIN_VERIFIED', sourceSeq: 10, batchId: 4 });
    const model = entity[0].toLowerCase() + entity.slice(1);
    expect(records[model].has(IDS.entity)).toBe(true);
    expect(prisma[model].create).toHaveBeenCalledTimes(1);
    expect(audit.recordV2).toHaveBeenCalledWith(expect.objectContaining({
      entity, entityId: IDS.entity, action: 'AUDIT_ENTITY_RECREATED_FROM_IPFS',
      metadata: expect.objectContaining({ sourceSeq: 10, sourceBatchId: 4 }),
    }), prisma);
  });

  it('[TC5.09] recreates an AI model from a verified encrypted audit snapshot with its original identity and inactive state', async () => {
    const modelCase = cases.find((item) => item.entity === 'AiModelRegistry')!;
    const { service, prisma, records, audit } = makeStore('AiModelRegistry', modelCase.snapshot);

    await expect(service.recreate(
      { entity: 'AiModelRegistry', entityId: IDS.entity },
      'admin-1',
      'Khôi phục AI model từ audit đã neo',
    )).resolves.toMatchObject({ status: 'RECREATED', source: 'IPFS_BLOCKCHAIN_VERIFIED', batchId: 4 });
    expect(prisma.aiModelRegistry.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      id: IDS.entity, modelId: 'model-business-id', createdBy: IDS.user,
      ipHashEncrypted: 'encrypted-ip-hash', status: 'INACTIVE', isActiveOnChain: true,
    }) });
    expect(records.aiModelRegistry.has(IDS.entity)).toBe(true);
    expect(audit.recordV2).toHaveBeenCalledWith(expect.objectContaining({
      entity: 'AiModelRegistry', entityId: IDS.entity, action: 'AUDIT_ENTITY_RECREATED_FROM_IPFS',
    }), prisma);
  });

  it('[TC5.10] blocks AI model recreation when the snapshot creator no longer exists', async () => {
    const modelCase = cases.find((item) => item.entity === 'AiModelRegistry')!;
    const { service, records, prisma } = makeStore('AiModelRegistry', modelCase.snapshot);
    records.user.clear();

    await expect(service.previewOne({ entity: 'AiModelRegistry', entityId: IDS.entity })).resolves.toMatchObject({
      recoverable: false,
      blockers: expect.arrayContaining(['MISSING_AI_MODEL_CREATOR']),
    });
    expect(prisma.aiModelRegistry.create).not.toHaveBeenCalled();
  });

  it('[TC5.11] blocks AI model recreation when its source modelId is already owned by another record', async () => {
    const modelCase = cases.find((item) => item.entity === 'AiModelRegistry')!;
    const { service, records, prisma } = makeStore('AiModelRegistry', modelCase.snapshot);
    records.aiModelRegistry.set(IDS.model, { id: IDS.model, modelId: 'model-business-id' });

    await expect(service.previewOne({ entity: 'AiModelRegistry', entityId: IDS.entity })).resolves.toMatchObject({
      recoverable: false,
      blockers: expect.arrayContaining(['AI_MODEL_UNIQUE_CONFLICT']),
    });
    expect(prisma.aiModelRegistry.create).not.toHaveBeenCalled();
    expect(records.aiModelRegistry.get(IDS.model)).toMatchObject({ modelId: 'model-business-id' });
  });

  it('[TC6.20] restores all valid AI diagnosis foreign keys and blocks a Visit/Patient mismatch', async () => {
    const diagnosisCase = cases.find((item) => item.entity === 'AiDiagnosis')!;
    const valid = makeStore('AiDiagnosis', diagnosisCase.snapshot);
    await valid.service.recreate({ entity: 'AiDiagnosis', entityId: IDS.entity }, 'admin-1', 'Khôi phục chẩn đoán AI');
    expect(valid.prisma.aiDiagnosis.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      aiModelId: IDS.model, patientId: IDS.patient, visitId: IDS.visit, reviewedByDoctorId: IDS.doctor,
    }) });

    const mismatch = makeStore('AiDiagnosis', diagnosisCase.snapshot);
    mismatch.records.visit.set(IDS.visit, { id: IDS.visit, patientId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' });
    const preview = await mismatch.service.previewOne({ entity: 'AiDiagnosis', entityId: IDS.entity });
    expect(preview).toMatchObject({ recoverable: false, blockers: expect.arrayContaining(['VISIT_PATIENT_MISMATCH']) });
    expect(mismatch.prisma.aiDiagnosis.create).not.toHaveBeenCalled();
  });

  it('[TC2.12] recreates a permanently deleted Department from a verified encrypted audit snapshot as inactive', async () => {
    const departmentCase = cases.find((item) => item.entity === 'Department')!;
    const { service, batchRecovery, prisma, records, audit } = makeStore('Department', departmentCase.snapshot);
    const deletionRow = buildPermanentDeletionRow(IDS.entity, departmentCase.snapshot);
    batchRecovery.loadVerifiedBundle.mockResolvedValueOnce({
      batchId: 4, artifactHash: `0x${'c'.repeat(64)}`, artifactUri: 'ipfs://verified-delete',
      merkleRoot: 'd'.repeat(64), logs: [deletionRow],
    });

    await expect(service.recreate(
      { entity: 'Department', entityId: IDS.entity },
      'admin-1',
      'Khôi phục sau xóa vĩnh viễn',
    )).resolves.toMatchObject({ status: 'RECREATED', sourceSeq: 11, source: 'IPFS_BLOCKCHAIN_VERIFIED' });
    expect(prisma.department.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      id: IDS.entity, departmentCode: 'PB-01', name: 'Khoa Noi', type: 'CLINICAL', status: 'INACTIVE',
    }) });
    expect(records.department.has(IDS.entity)).toBe(true);
    expect(audit.recordV2).toHaveBeenCalledWith(expect.objectContaining({
      entity: 'Department', entityId: IDS.entity, action: 'AUDIT_ENTITY_RECREATED_FROM_IPFS',
    }), prisma);
  });

  it('[TC6.21] recreates a deleted MedicalConclusion with its Visit, Doctor, and AI diagnosis relations intact', async () => {
    const conclusionCase = cases.find((item) => item.entity === 'MedicalConclusion')!;
    const { service, prisma, records, audit } = makeStore('MedicalConclusion', conclusionCase.snapshot);

    await expect(service.recreate(
      { entity: 'MedicalConclusion', entityId: IDS.entity },
      'admin-1',
      'Khôi phục kết luận y khoa từ audit đã neo',
    )).resolves.toMatchObject({ status: 'RECREATED', source: 'IPFS_BLOCKCHAIN_VERIFIED', batchId: 4 });
    expect(prisma.medicalConclusion.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      id: IDS.entity, visitId: IDS.visit, doctorId: IDS.doctor, aiDiagnosisId: IDS.diagnosis,
      finalDiagnosis: 'Trusted conclusion',
    }) });
    expect(records.medicalConclusion.has(IDS.entity)).toBe(true);
    expect(audit.recordV2).toHaveBeenCalledWith(expect.objectContaining({
      entity: 'MedicalConclusion', entityId: IDS.entity, action: 'AUDIT_ENTITY_RECREATED_FROM_IPFS',
    }), prisma);
  });

  it('[TC6.21A] recreates a deleted MedicalConclusion after first recreating its missing verified Visit dependency', async () => {
    const conclusionCase = cases.find((item) => item.entity === 'MedicalConclusion')!;
    const visitCase = cases.find((item) => item.entity === 'Visit')!;
    const store = makeStore('MedicalConclusion', conclusionCase.snapshot);
    store.records.visit.clear();
    store.records.department.set(IDS.department, { id: IDS.department, departmentCode: 'PB-01' });
    store.records.staffProfile.set(IDS.staff, { id: IDS.staff, employeeCode: 'NV-0001' });
    const visitRow = buildRow('Visit', IDS.visit, visitCase.snapshot);
    store.batchRecovery.loadVerifiedBundle.mockResolvedValue({
      batchId: 4, artifactHash: `0x${'e'.repeat(64)}`, artifactUri: 'ipfs://verified-chain',
      merkleRoot: 'f'.repeat(64), logs: [store.sourceRow, visitRow],
    });

    await expect(store.service.previewOne({ entity: 'MedicalConclusion', entityId: IDS.entity })).resolves.toMatchObject({
      recoverable: true,
      recoveryMode: 'DEPENDENCY_CHAIN',
      blockers: [],
      dependencies: [{ entity: 'Visit', entityId: IDS.visit }],
    });
    await expect(store.service.recreate(
      { entity: 'MedicalConclusion', entityId: IDS.entity },
      'admin-1',
      'Khôi phục kết luận cùng lượt khám cha',
    )).resolves.toMatchObject({ status: 'RECREATED' });

    expect(store.records.visit.get(IDS.visit)).toMatchObject({ visitCode: 'LK-0001', patientId: IDS.patient });
    expect(store.records.medicalConclusion.get(IDS.entity)).toMatchObject({ visitId: IDS.visit, finalDiagnosis: 'Trusted conclusion' });
    expect(store.prisma.visit.create).toHaveBeenCalledTimes(1);
    expect(store.prisma.medicalConclusion.create).toHaveBeenCalledTimes(1);
    expect(store.audit.recordV2).toHaveBeenCalledTimes(2);
  });

  it('[TC6.22] blocks MedicalConclusion recreation when the Visit already has another conclusion or AI diagnosis belongs elsewhere', async () => {
    const conclusionCase = cases.find((item) => item.entity === 'MedicalConclusion')!;
    const conflict = makeStore('MedicalConclusion', conclusionCase.snapshot);
    conflict.records.medicalConclusion.set('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', {
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', visitId: IDS.visit,
    });
    await expect(conflict.service.previewOne({ entity: 'MedicalConclusion', entityId: IDS.entity })).resolves.toMatchObject({
      recoverable: false,
      blockers: expect.arrayContaining(['VISIT_ALREADY_HAS_CONCLUSION']),
    });
    expect(conflict.prisma.medicalConclusion.create).not.toHaveBeenCalled();

    const mismatch = makeStore('MedicalConclusion', conclusionCase.snapshot);
    mismatch.records.aiDiagnosis.set(IDS.diagnosis, { id: IDS.diagnosis, visitId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' });
    await expect(mismatch.service.previewOne({ entity: 'MedicalConclusion', entityId: IDS.entity })).resolves.toMatchObject({
      recoverable: false,
      blockers: expect.arrayContaining(['DIAGNOSIS_VISIT_MISMATCH']),
    });
    expect(mismatch.prisma.medicalConclusion.create).not.toHaveBeenCalled();
  });

  it('[TC3.15] recreates StaffProfile onto its original User tombstone without replacing the password hash', async () => {
    const staffCase = cases.find((item) => item.entity === 'StaffProfile')!;
    const { service, records, prisma, audit } = makeStore('StaffProfile', staffCase.snapshot);
    records.user.set(IDS.user, { ...recoveryUser('RECEPTIONIST'), id: IDS.user, status: 'DELETE' });

    await service.recreate(
      { entity: 'StaffProfile', entityId: IDS.entity },
      'admin-1',
      'Khôi phục nhân sự từ tài khoản tombstone',
    );

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: IDS.user },
      data: expect.objectContaining({ status: 'INACTIVE', deletedAt: null, deletedBy: null }),
    });
    expect(records.user).toHaveProperty('size', 1);
    expect(records.user.get(IDS.user)).toMatchObject({ status: 'INACTIVE', passwordHash: '$argon2id$trusted-hash' });
    expect(records.staffProfile.get(IDS.entity)).toMatchObject({ userId: IDS.user, employeeCode: 'NV-0001' });
    expect(audit.recordV2).toHaveBeenCalledWith(expect.objectContaining({ action: 'AUDIT_ENTITY_RECREATED_FROM_IPFS' }), prisma);
  });

  it('[TC3.16] blocks StaffProfile recreation when its employee code or citizen ID is owned by another profile', async () => {
    const staffCase = cases.find((item) => item.entity === 'StaffProfile')!;
    const { service, records, prisma } = makeStore('StaffProfile', staffCase.snapshot);
    records.staffProfile.set(IDS.staff, {
      id: IDS.staff, userId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      employeeCode: 'NV-0001', citizenId: '101122334455',
    });

    await expect(service.previewOne({ entity: 'StaffProfile', entityId: IDS.entity })).resolves.toMatchObject({
      recoverable: false,
      blockers: expect.arrayContaining(['STAFF_UNIQUE_CONFLICT']),
    });
    expect(prisma.staffProfile.create).not.toHaveBeenCalled();
    expect(records.staffProfile.get(IDS.staff)).toMatchObject({ employeeCode: 'NV-0001' });
  });

  it('[TC4.10] recreates Doctor and Staff profiles from an anchored snapshot and reactivates the original User tombstone', async () => {
    const doctorCase = cases.find((item) => item.entity === 'DoctorProfile')!;
    const { service, records, prisma } = makeStore('DoctorProfile', doctorCase.snapshot);
    records.user.set(IDS.user, { ...recoveryUser('DOCTOR'), id: IDS.user, status: 'DELETE' });

    await service.recreate({ entity: 'DoctorProfile', entityId: IDS.entity }, 'admin-1', 'Khôi phục bác sĩ');

    expect(records.user.get(IDS.user)).toMatchObject({ status: 'INACTIVE', passwordHash: '$argon2id$trusted-hash' });
    expect(records.staffProfile.get(IDS.staff)).toMatchObject({ userId: IDS.user, departmentId: IDS.department });
    expect(records.doctorProfile.get(IDS.entity)).toMatchObject({
      staffProfileId: IDS.staff, specialty: 'GENERAL_INTERNAL_MEDICINE', licenseNumber: 'GPH-001',
    });
    expect(prisma.doctorProfile.create).toHaveBeenCalledTimes(1);
  });

  it('[TC4.11] blocks Doctor recreation when the source license belongs to another Doctor', async () => {
    const doctorCase = cases.find((item) => item.entity === 'DoctorProfile')!;
    const { service, records, prisma } = makeStore('DoctorProfile', doctorCase.snapshot);
    records.doctorProfile.set(IDS.doctor, { id: IDS.doctor, staffProfileId: 'other-staff', licenseNumber: 'GPH-001' });

    await expect(service.previewOne({ entity: 'DoctorProfile', entityId: IDS.entity })).resolves.toMatchObject({
      recoverable: false, blockers: expect.arrayContaining(['DOCTOR_UNIQUE_CONFLICT']),
    });
    expect(prisma.doctorProfile.create).not.toHaveBeenCalled();
  });

  it('[TC4.12] blocks Doctor recreation when the source Department no longer exists', async () => {
    const doctorCase = cases.find((item) => item.entity === 'DoctorProfile')!;
    const { service, records, prisma } = makeStore('DoctorProfile', doctorCase.snapshot);
    records.department.clear();

    await expect(service.previewOne({ entity: 'DoctorProfile', entityId: IDS.entity })).resolves.toMatchObject({
      recoverable: false, blockers: expect.arrayContaining(['MISSING_DEPARTMENT_NOT_RECOVERABLE']),
    });
    expect(prisma.doctorProfile.create).not.toHaveBeenCalled();
  });

  it('[TC4.13] blocks Doctor recreation when the User tombstone is already linked to another StaffProfile', async () => {
    const doctorCase = cases.find((item) => item.entity === 'DoctorProfile')!;
    const { service, records, prisma } = makeStore('DoctorProfile', doctorCase.snapshot);
    records.user.set(IDS.user, { ...recoveryUser('DOCTOR'), id: IDS.user, status: 'INACTIVE' });
    records.staffProfile.set('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', {
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', userId: IDS.user,
      employeeCode: 'BS-OTHER', citizenId: '999999999999',
    });

    await expect(service.previewOne({ entity: 'DoctorProfile', entityId: IDS.entity })).resolves.toMatchObject({
      recoverable: false, blockers: expect.arrayContaining(['USER_ALREADY_HAS_STAFF_PROFILE']),
    });
    expect(prisma.doctorProfile.create).not.toHaveBeenCalled();
    expect(records.staffProfile.get('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')).toMatchObject({ userId: IDS.user });
  });

  it('rejects a diagnosis when any required relation is missing', async () => {
    const diagnosisCase = cases.find((item) => item.entity === 'AiDiagnosis')!;
    const { service, records } = makeStore('AiDiagnosis', diagnosisCase.snapshot);
    records.aiModelRegistry.clear();
    records.patient.clear();
    records.visit.clear();
    records.doctorProfile.clear();

    const preview = await service.previewOne({ entity: 'AiDiagnosis', entityId: IDS.entity });
    expect(preview.blockers).toEqual(expect.arrayContaining([
      'MISSING_AI_MODEL_NOT_RECOVERABLE', 'MISSING_PATIENT_NOT_RECOVERABLE', 'MISSING_VISIT_NOT_RECOVERABLE', 'MISSING_REVIEWING_DOCTOR_NOT_RECOVERABLE',
    ]));
    expect(preview.recoverable).toBe(false);
  });

  it('rejects a modified encrypted snapshot instead of falling back to untrusted data', async () => {
    const patientCase = cases[0];
    const { service, sourceRow } = makeStore(patientCase.entity, patientCase.snapshot);
    const encrypted = sourceRow.afterEncrypted as any;
    encrypted.ciphertext = `${encrypted.ciphertext.slice(0, -2)}AA`;

    const preview = await service.previewOne({ entity: patientCase.entity, entityId: IDS.entity });
    expect(preview.recoverable).toBe(false);
    expect(preview.blockers.join(' ')).toContain('Không tìm thấy snapshot');
  });

  it('resolves cascading dependency on AiDiagnosis when AiQuality is missing AiDiagnosis', async () => {
    const qualityCase = cases.find((item) => item.entity === 'AiQuality')!;
    const diagnosisCase = cases.find((item) => item.entity === 'AiDiagnosis')!;
    const { service, records, batchRecovery, sourceRow } = makeStore('AiQuality', qualityCase.snapshot);
    const diagnosisRow = buildRow('AiDiagnosis', IDS.diagnosis, diagnosisCase.snapshot);
    batchRecovery.loadVerifiedBundle.mockResolvedValue({
      batchId: 4, artifactHash: `0x${'a'.repeat(64)}`, artifactUri: 'ipfs://verified', merkleRoot: 'b'.repeat(64),
      logs: [sourceRow, diagnosisRow],
    });
    records.aiDiagnosis.clear();

    const preview = await service.previewOne({ entity: 'AiQuality', entityId: IDS.entity });
    expect(preview.dependencies).toEqual([{ entity: 'AiDiagnosis', entityId: IDS.diagnosis }]);
    expect(preview.recoveryMode).toBe('DEPENDENCY_CHAIN');
    expect(preview.recoverable).toBe(true);
  });

  it('rolls back the recreated entity when appending the recovery audit fails', async () => {
    const patientCase = cases[0];
    const { service, audit, records } = makeStore(patientCase.entity, patientCase.snapshot);
    audit.recordV2.mockRejectedValueOnce(new Error('audit append failed'));

    await expect(service.recreate(
      { entity: patientCase.entity, entityId: IDS.entity },
      'admin-1',
      'Khôi phục phải atomic với audit',
    )).rejects.toThrow('audit append failed');
    expect(records.patient.has(IDS.entity)).toBe(false);
  });
});
