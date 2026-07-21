import { EntityRecreationService, RecreatableAuditEntity } from '../../../../../src/infrastructure/audit/entity-recreation.service';
import { AuditRecoveryBundleRow } from '../../../../../src/infrastructure/audit/audit-artifact.service';
import { AuditLoggerService } from '../../../../../src/infrastructure/audit/audit-logger.service';
import {
  AUDIT_ENTRY_V2,
  canonicalize,
  computeAfterHashV2,
  computeBeforeHashV2,
  computeDataHashV2,
  computeDiffHashV2,
  computeEntryHashV2,
  GENESIS_PREV_HASH,
} from '../../../../../src/infrastructure/audit/audit-hash.util';
import { buildAuditDiff } from '../../../../../src/infrastructure/audit/audit-diff.util';
import { buildAuditEncryptionAad, encryptAuditSnapshot } from '../../../../../src/infrastructure/audit/audit-encryption.util';

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
    aiModelRegistryId: null, medicalConclusionId: null, aiQualityId: null, createdAt,
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
    aiModelRegistryId: null, medicalConclusionId: null, aiQualityId: null, createdAt,
  };
}

function makeStore(entity: RecreatableAuditEntity, snapshot: Snapshot) {
  const records: Record<string, Map<string, any>> = {
    user: new Map(), department: new Map(), staffProfile: new Map(), doctorProfile: new Map(), patient: new Map(),
    aiModelRegistry: new Map(), aiDiagnosis: new Map(), medicalConclusion: new Map(), visit: new Map(),
  };
  const targetId = IDS.entity;

  const seed = (model: string, id: string, value: any) => records[model].set(id, { id, ...value });
  if (entity === 'DoctorProfile') seed('department', IDS.department, { departmentCode: 'PB-01' });
  if (entity === 'AiModelRegistry') seed('user', IDS.user, { role: 'ADMIN', status: 'ACTIVE' });
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
      findFirst: jest.fn(async () => null),
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

  it('restores every AI diagnosis foreign key and rejects a visit/patient mismatch', async () => {
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

  it('uses the encrypted before snapshot from a permanent-deletion audit row', async () => {
    const departmentCase = cases.find((item) => item.entity === 'Department')!;
    const { service, batchRecovery, prisma } = makeStore('Department', departmentCase.snapshot);
    const deletionRow = buildPermanentDeletionRow(IDS.entity, departmentCase.snapshot);
    batchRecovery.loadVerifiedBundle.mockResolvedValueOnce({
      batchId: 4, artifactHash: `0x${'c'.repeat(64)}`, artifactUri: 'ipfs://verified-delete',
      merkleRoot: 'd'.repeat(64), logs: [deletionRow],
    });

    await expect(service.recreate(
      { entity: 'Department', entityId: IDS.entity },
      'admin-1',
      'Khôi phục sau xóa vĩnh viễn',
    )).resolves.toMatchObject({ status: 'RECREATED', sourceSeq: 11 });
    expect(prisma.department.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      id: IDS.entity, departmentCode: 'PB-01', status: 'INACTIVE',
    }) });
  });

  it('reactivates the preserved User tombstone as INACTIVE when recreating StaffProfile', async () => {
    const staffCase = cases.find((item) => item.entity === 'StaffProfile')!;
    const { service, records, prisma } = makeStore('StaffProfile', staffCase.snapshot);
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
    expect(records.user.get(IDS.user).status).toBe('INACTIVE');
    expect(records.staffProfile.has(IDS.entity)).toBe(true);
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
      'MISSING_AI_MODEL', 'MISSING_PATIENT', 'MISSING_VISIT', 'MISSING_REVIEWING_DOCTOR',
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
