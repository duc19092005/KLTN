import { ConflictException } from '@nestjs/common';
import { EntityRecoveryService } from '../../../../../src/infrastructure/audit';
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

const patientAfter = {
  patientCode: 'BN-0001',
  fullName: 'Nguyen Van A',
  gender: 'MALE',
  birthDate: '1990-01-01T00:00:00.000Z',
  citizenId: '001122334455',
  phone: '0900000000',
  address: 'Sensitive address',
  insuranceNumber: null,
  emergencyContact: null,
};

function buildPatientAuditRow(overrides: Record<string, unknown> = {}) {
  const base = {
    id: 'audit-1',
    seq: 10,
    prevHash: GENESIS_PREV_HASH,
    entity: 'Patient',
    entityId: '11111111-1111-4111-8111-111111111111',
    action: 'UPDATE',
    actorId: 'admin-1',
    createdAt: new Date('2026-07-12T03:00:00.000Z'),
  };
  const before = { ...patientAfter, phone: '0911111111' };
  const diffJson = buildAuditDiff(before, patientAfter);
  const fieldsChanged = diffJson.fieldsChanged;
  const beforeHash = computeBeforeHashV2(base.entity, base.entityId, before);
  const afterHash = computeAfterHashV2(base.entity, base.entityId, patientAfter);
  const diffHash = computeDiffHashV2(diffJson);
  const dataHash = computeDataHashV2({
    entity: base.entity,
    entityId: base.entityId,
    action: base.action,
    beforeHash,
    afterHash,
    diffHash,
    fieldsChanged,
  });
  const entryHash = computeEntryHashV2({
    seq: base.seq,
    prevHash: base.prevHash,
    entity: base.entity,
    entityId: base.entityId,
    action: base.action,
    actorId: base.actorId,
    beforeHash,
    afterHash,
    diffHash,
    dataHash,
    createdAtIso: base.createdAt.toISOString(),
  });
  const aad = buildAuditEncryptionAad({
    seq: base.seq,
    entity: base.entity,
    entityId: base.entityId,
    action: base.action,
    createdAtIso: base.createdAt.toISOString(),
  });

  return {
    ...base,
    dataHash,
    beforeHash,
    afterHash,
    diffHash,
    hashVersion: AUDIT_ENTRY_V2,
    beforeEncrypted: encryptAuditSnapshot(canonicalize(before), aad),
    afterEncrypted: encryptAuditSnapshot(canonicalize(patientAfter), aad),
    diffJson,
    fieldsChanged,
    entryHash,
    onChainStatus: 'PENDING',
    batchId: null,
    ...overrides,
  };
}

function buildStaffAuditRow(after: Record<string, unknown>) {
  const base = {
    id: 'audit-staff-1', seq: 21, prevHash: GENESIS_PREV_HASH,
    entity: 'StaffProfile', entityId: '22222222-2222-4222-8222-222222222222',
    action: 'CREATE', actorId: 'admin-1', createdAt: new Date('2026-07-12T09:34:30.514Z'),
  };
  const diffJson = buildAuditDiff(null, after);
  const fieldsChanged = diffJson.fieldsChanged;
  const beforeHash = computeBeforeHashV2(base.entity, base.entityId, null);
  const afterHash = computeAfterHashV2(base.entity, base.entityId, after);
  const diffHash = computeDiffHashV2(diffJson);
  const dataHash = computeDataHashV2({ entity: base.entity, entityId: base.entityId, action: base.action, beforeHash, afterHash, diffHash, fieldsChanged });
  const entryHash = computeEntryHashV2({ ...base, beforeHash, afterHash, diffHash, dataHash, createdAtIso: base.createdAt.toISOString() });
  const aad = buildAuditEncryptionAad({ seq: base.seq, entity: base.entity, entityId: base.entityId, action: base.action, createdAtIso: base.createdAt.toISOString() });
  return {
    ...base, dataHash, beforeHash, afterHash, diffHash, hashVersion: AUDIT_ENTRY_V2,
    beforeEncrypted: encryptAuditSnapshot(canonicalize(null), aad),
    afterEncrypted: encryptAuditSnapshot(canonicalize(after), aad),
    diffJson, fieldsChanged, entryHash, onChainStatus: 'ANCHORED', batchId: 13,
  };
}

function buildAiDiagnosisAuditRow(after: Record<string, unknown>) {
  const base = {
    id: 'audit-ai-1', seq: 30, prevHash: GENESIS_PREV_HASH,
    entity: 'AiDiagnosis', entityId: '33333333-3333-4333-8333-333333333333',
    action: 'CREATE', actorId: 'doctor-user-1', createdAt: new Date('2026-07-12T10:00:00.000Z'),
  };
  const diffJson = buildAuditDiff(null, after);
  const fieldsChanged = diffJson.fieldsChanged;
  const beforeHash = computeBeforeHashV2(base.entity, base.entityId, null);
  const afterHash = computeAfterHashV2(base.entity, base.entityId, after);
  const diffHash = computeDiffHashV2(diffJson);
  const dataHash = computeDataHashV2({ entity: base.entity, entityId: base.entityId, action: base.action, beforeHash, afterHash, diffHash, fieldsChanged });
  const entryHash = computeEntryHashV2({ ...base, beforeHash, afterHash, diffHash, dataHash, createdAtIso: base.createdAt.toISOString() });
  const aad = buildAuditEncryptionAad({ seq: base.seq, entity: base.entity, entityId: base.entityId, action: base.action, createdAtIso: base.createdAt.toISOString() });
  return {
    ...base, dataHash, beforeHash, afterHash, diffHash, hashVersion: AUDIT_ENTRY_V2,
    beforeEncrypted: encryptAuditSnapshot(canonicalize(null), aad),
    afterEncrypted: encryptAuditSnapshot(canonicalize(after), aad),
    diffJson, fieldsChanged, entryHash, onChainStatus: 'ANCHORED', batchId: 20,
  };
}

describe('EntityRecoveryService integrity gate', () => {
  const originalHashKey = process.env.AUDIT_HASH_KEY;
  const originalEncryptionKey = process.env.AUDIT_ENCRYPTION_KEY;
  const originalEncryptionKeyId = process.env.AUDIT_ENCRYPTION_KEY_ID;

  beforeEach(() => {
    process.env.AUDIT_HASH_KEY = 'entity-recovery-test-hash-key-00000001';
    process.env.AUDIT_ENCRYPTION_KEY = '22'.repeat(32);
    process.env.AUDIT_ENCRYPTION_KEY_ID = 'entity-recovery-test-key';
  });

  afterAll(() => {
    if (originalHashKey === undefined) delete process.env.AUDIT_HASH_KEY;
    else process.env.AUDIT_HASH_KEY = originalHashKey;
    if (originalEncryptionKey === undefined) delete process.env.AUDIT_ENCRYPTION_KEY;
    else process.env.AUDIT_ENCRYPTION_KEY = originalEncryptionKey;
    if (originalEncryptionKeyId === undefined) delete process.env.AUDIT_ENCRYPTION_KEY_ID;
    else process.env.AUDIT_ENCRYPTION_KEY_ID = originalEncryptionKeyId;
  });

  function setup(row: ReturnType<typeof buildPatientAuditRow>, live: Record<string, unknown>) {
    const prisma = {
      blockchainLogger: { findFirst: jest.fn().mockResolvedValue(row) },
      patient: { findUnique: jest.fn().mockResolvedValue({ ...live, birthDate: new Date(String(live.birthDate)) }) },
    };
    const audit = { hashSnapshot: jest.fn() };
    const anchor = { getInclusionProof: jest.fn().mockResolvedValue({ verified: true }) };
    return {
      service: new EntityRecoveryService(prisma as never, audit as never, anchor as never),
      anchor,
    };
  }

  it('allows a second valid mutation while the latest Tier B audit is still pending', async () => {
    const row = buildPatientAuditRow();
    const { service, anchor } = setup(row, patientAfter);

    await expect(service.assertTrusted('Patient', row.entityId)).resolves.toBeUndefined();
    expect(anchor.getInclusionProof).not.toHaveBeenCalled();
  });

  it('blocks mutation and redacts sensitive field names when live data differs from an anchored audit', async () => {
    const row = buildPatientAuditRow({ onChainStatus: 'ANCHORED', batchId: 7 });
    const { service, anchor } = setup(row, { ...patientAfter, fullName: 'Tampered Name' });

    let response: unknown;
    try {
      await service.assertTrusted('Patient', row.entityId);
    } catch (error) {
      expect(error).toBeInstanceOf(ConflictException);
      response = (error as ConflictException).getResponse();
    }

    expect(anchor.getInclusionProof).toHaveBeenCalledWith(row.seq);
    expect(response).toMatchObject({
      code: 'ENTITY_INTEGRITY_WARNING',
      recoveryRequired: true,
      fieldsChanged: ['SENSITIVE_FIELD_CHANGED'],
    });
    expect(JSON.stringify(response)).not.toContain('Tampered Name');
    expect(JSON.stringify(response)).not.toContain(patientAfter.fullName);
  });

  it('does not allow entity recovery from a tampered audit row that is still pending', async () => {
    const row = buildPatientAuditRow();
    const { service, anchor } = setup(row, { ...patientAfter, phone: '0999999999' });

    let response: unknown;
    try {
      await service.assertTrusted('Patient', row.entityId);
    } catch (error) {
      expect(error).toBeInstanceOf(ConflictException);
      response = (error as ConflictException).getResponse();
    }

    expect(response).toMatchObject({
      code: 'ENTITY_INTEGRITY_WARNING',
      recoveryRequired: false,
    });
    expect(response).toMatchObject({ message: expect.stringMatching(/chưa được neo|audit này chưa được neo/i) });
    expect(anchor.getInclusionProof).not.toHaveBeenCalled();
    expect(JSON.stringify(response)).not.toContain('0999999999');
    expect(JSON.stringify(response)).not.toContain(patientAfter.phone);
  });

  it('blocks entity recovery when the blockchain inclusion proof is not verified', async () => {
    const row = buildPatientAuditRow({ onChainStatus: 'ANCHORED', batchId: 7 });
    const { service, anchor } = setup(row, { ...patientAfter, fullName: 'Tampered Name' });
    anchor.getInclusionProof.mockResolvedValueOnce({ verified: false });

    let response: unknown;
    try {
      await service.assertTrusted('Patient', row.entityId);
    } catch (error) {
      expect(error).toBeInstanceOf(ConflictException);
      response = (error as ConflictException).getResponse();
    }

    expect(response).toMatchObject({
      code: 'ENTITY_INTEGRITY_WARNING',
      recoveryRequired: false,
    });
    expect(response).toMatchObject({ message: expect.stringMatching(/chưa xác minh|kiểm tra batch/i) });
    expect(anchor.getInclusionProof).toHaveBeenCalledWith(row.seq);
    expect(JSON.stringify(response)).not.toContain('Tampered Name');
    expect(JSON.stringify(response)).not.toContain(patientAfter.fullName);
  });

  it('restores only the selected entity and returns no decrypted snapshot', async () => {
    const row = buildPatientAuditRow({ onChainStatus: 'ANCHORED', batchId: 7 });
    const tampered = { ...patientAfter, fullName: 'Tampered Name', birthDate: new Date(patientAfter.birthDate) };
    const restored = { ...patientAfter, birthDate: new Date(patientAfter.birthDate) };
    const tx = {
      $executeRaw: jest.fn().mockResolvedValue(1),
      patient: {
        findUnique: jest.fn().mockResolvedValueOnce(tampered).mockResolvedValue(restored),
        update: jest.fn().mockResolvedValue(restored),
      },
    };
    const prisma = {
      blockchainLogger: { findFirst: jest.fn().mockResolvedValue(row), findMany: jest.fn().mockResolvedValue([row]) },
      patient: { findUnique: jest.fn().mockResolvedValue(tampered) },
      $transaction: jest.fn().mockImplementation(async (callback) => callback(tx)),
    };
    const audit = {
      hashSnapshot: jest.fn().mockReturnValue({ hash: 'record-hash', salt: 'record-salt' }),
      recordV2: jest.fn().mockResolvedValue(undefined),
    };
    const anchor = { getInclusionProof: jest.fn().mockResolvedValue({ verified: true }) };
    const service = new EntityRecoveryService(prisma as never, audit as never, anchor as never);

    const result = await service.recoverMany(
      [{ entity: 'Patient', entityId: row.entityId }],
      'admin-1',
      'Khôi phục theo cảnh báo toàn vẹn',
    );

    console.log('RECOVERY RESULT:', JSON.stringify(result, null, 2));
    expect(result).toMatchObject({ requested: 1, recovered: 1, failed: 0 });
    expect(tx.patient.update).toHaveBeenCalledTimes(2);
    expect(audit.recordV2).toHaveBeenCalledWith(expect.objectContaining({
      entity: 'Patient',
      entityId: row.entityId,
      action: 'AUDIT_ENTITY_RECOVERED',
    }), tx);
    expect(JSON.stringify(result)).not.toContain('Tampered Name');
    expect(JSON.stringify(result)).not.toContain(patientAfter.fullName);
    expect(JSON.stringify(result)).not.toContain('afterEncrypted');
  });

  it('does not report a false tamper warning for legacy staff snapshots with null user status', async () => {
    const legacySnapshot = {
      employeeCode: 'NV-0001', fullName: 'Le Tan', phone: '0914370300', gender: 'Nam',
      citizenId: '000000000000', birthDate: '2003-01-12T00:00:00.000Z', address: 'Dia chi',
      avatarUrl: 'https://example.test/avatar.jpg', departmentId: null, position: 'Le tan', status: null,
    };
    const row = buildStaffAuditRow(legacySnapshot);
    const prisma = {
      blockchainLogger: { findFirst: jest.fn().mockResolvedValue(row), findMany: jest.fn().mockResolvedValue([row]) },
      staffProfile: {
        findUnique: jest.fn().mockResolvedValue({
          ...legacySnapshot,
          birthDate: new Date(String(legacySnapshot.birthDate)),
          user: { status: 'ACTIVE' },
        }),
      },
    };
    const anchor = { getInclusionProof: jest.fn().mockResolvedValue({ verified: true }) };
    const service = new EntityRecoveryService(prisma as never, {} as never, anchor as never);

    await expect(service.assertTrusted('StaffProfile', row.entityId)).resolves.toBeUndefined();
    expect(anchor.getInclusionProof).not.toHaveBeenCalled();
  });

  it('restores an AI diagnosis from its latest anchored encrypted snapshot', async () => {
    const trusted = {
      aiModelId: '44444444-4444-4444-8444-444444444444',
      patientId: '55555555-5555-4555-8555-555555555555',
      visitId: '66666666-6666-4666-8666-666666666666',
      prompt: 'trusted prompt', result: '{"analysis":"trusted"}', confidence: 0.85,
      status: 'AI_SUGGESTED', reviewedByDoctorId: null, doctorFeedback: null,
    };
    const tampered = { ...trusted, result: '{"analysis":"tampered"}' };
    const row = buildAiDiagnosisAuditRow(trusted);
    const tx = {
      $executeRaw: jest.fn().mockResolvedValue(1),
      aiDiagnosis: {
        findUnique: jest.fn().mockResolvedValueOnce(tampered).mockResolvedValue(trusted),
        update: jest.fn().mockResolvedValue(trusted),
      },
      aiModelRegistry: { findUnique: jest.fn().mockResolvedValue({ id: trusted.aiModelId }) },
      patient: { findUnique: jest.fn().mockResolvedValue({ id: trusted.patientId }) },
      visit: { findUnique: jest.fn().mockResolvedValue({ id: trusted.visitId }) },
    };
    const prisma = {
      blockchainLogger: { findFirst: jest.fn().mockResolvedValue(row), findMany: jest.fn().mockResolvedValue([row]) },
      aiDiagnosis: { findUnique: jest.fn().mockResolvedValue(tampered) },
      $transaction: jest.fn().mockImplementation(async (callback) => callback(tx)),
    };
    const audit = {
      hashSnapshot: jest.fn().mockReturnValue({ hash: 'unused', salt: 'unused' }),
      recordV2: jest.fn().mockResolvedValue(undefined),
    };
    const anchor = { getInclusionProof: jest.fn().mockResolvedValue({ verified: true }) };
    const service = new EntityRecoveryService(prisma as never, audit as never, anchor as never);

    const result = await service.recoverMany(
      [{ entity: 'AiDiagnosis', entityId: row.entityId }],
      'admin-1',
      'Khôi phục chẩn đoán AI bị thay đổi trái phép',
    );

    expect(result).toMatchObject({ requested: 1, recovered: 1, failed: 0 });
    expect(tx.aiDiagnosis.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: row.entityId },
      data: expect.objectContaining({ result: trusted.result, confidence: trusted.confidence }),
    }));
    expect(audit.recordV2).toHaveBeenCalledWith(expect.objectContaining({
      entity: 'AiDiagnosis', action: 'AUDIT_ENTITY_RECOVERED',
    }), tx);
    expect(JSON.stringify(result)).not.toContain(trusted.result);
  });
});
