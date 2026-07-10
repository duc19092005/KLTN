import { AuditController } from './audit.controller';
import {
  AUDIT_ENTRY_V2,
  canonicalize,
  computeAfterHashV2,
  computeBeforeHashV2,
  computeDataHashV2,
  computeDiffHashV2,
  computeEntryHashV2,
  GENESIS_PREV_HASH,
} from '../../../infrastructure/audit/audit-hash.util';
import { buildAuditDiff } from '../../../infrastructure/audit/audit-diff.util';
import { buildAuditEncryptionAad, encryptAuditSnapshot } from '../../../infrastructure/audit/audit-encryption.util';

function buildV2Row() {
  const base = {
    id: 'log-1',
    seq: 1,
    prevHash: GENESIS_PREV_HASH,
    entity: 'StaffProfile',
    entityId: 'staff-1',
    action: 'UPDATE',
    actorId: 'admin-1',
    createdAt: new Date('2026-06-10T00:00:00.000Z'),
    onChainStatus: 'PENDING',
    txHash: null,
    blockNumber: null,
    batchId: null,
  };
  const before = { fullName: 'abc', avatarUrl: 'https://cdn.example/old.png' };
  const after = { fullName: 'def', avatarUrl: 'https://cdn.example/new.png' };
  const diffJson = buildAuditDiff(before, after);
  const fieldsChanged = diffJson.fieldsChanged;
  const beforeHash = computeBeforeHashV2(base.entity, base.entityId, before);
  const afterHash = computeAfterHashV2(base.entity, base.entityId, after);
  const diffHash = computeDiffHashV2(diffJson);
  const dataHash = computeDataHashV2({ entity: base.entity, entityId: base.entityId, action: base.action, beforeHash, afterHash, diffHash, fieldsChanged });
  const entryHash = computeEntryHashV2({ ...base, beforeHash, afterHash, diffHash, dataHash, createdAtIso: base.createdAt.toISOString() });
  const aad = buildAuditEncryptionAad({ seq: base.seq, entity: base.entity, entityId: base.entityId, action: base.action, createdAtIso: base.createdAt.toISOString() });
  return {
    ...base,
    dataHash,
    beforeHash,
    afterHash,
    diffHash,
    hashVersion: AUDIT_ENTRY_V2,
    beforeEncrypted: encryptAuditSnapshot(canonicalize(before), aad),
    afterEncrypted: encryptAuditSnapshot(canonicalize(after), aad),
    diffJson,
    fieldsChanged,
    entryHash,
  };
}

describe('AuditController readable V2 diff', () => {
  const originalHashKey = process.env.AUDIT_HASH_KEY;
  const originalEncryptionKey = process.env.AUDIT_ENCRYPTION_KEY;
  const originalEncryptionKeyId = process.env.AUDIT_ENCRYPTION_KEY_ID;

  beforeEach(() => {
    process.env.AUDIT_HASH_KEY = 'audit-hash-key-for-controller-tests';
    process.env.AUDIT_ENCRYPTION_KEY = '11'.repeat(32);
    process.env.AUDIT_ENCRYPTION_KEY_ID = 'audit-key-test';
  });

  afterEach(() => {
    if (originalHashKey === undefined) delete process.env.AUDIT_HASH_KEY;
    else process.env.AUDIT_HASH_KEY = originalHashKey;
    if (originalEncryptionKey === undefined) delete process.env.AUDIT_ENCRYPTION_KEY;
    else process.env.AUDIT_ENCRYPTION_KEY = originalEncryptionKey;
    if (originalEncryptionKeyId === undefined) delete process.env.AUDIT_ENCRYPTION_KEY_ID;
    else process.env.AUDIT_ENCRYPTION_KEY_ID = originalEncryptionKeyId;
  });

  function setup() {
    const row = buildV2Row();
    const actor = {
      id: 'admin-1',
      username: 'admin',
      email: 'admin@example.com',
      role: 'ADMIN',
      staffProfile: null,
      adminProfile: { adminUserName: 'System Admin' },
    };
    const prisma = {
      blockchainLogger: {
        findMany: jest.fn().mockResolvedValue([row]),
        count: jest.fn().mockResolvedValue(1),
        findFirst: jest.fn().mockResolvedValue(row),
      },
      user: {
        findMany: jest.fn().mockResolvedValue([actor]),
        findUnique: jest.fn().mockResolvedValue(actor),
      },
      auditBatch: { findMany: jest.fn(), count: jest.fn() },
      staffProfile: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'staff-1',
          userId: 'user-1',
          fullName: 'Staff Member',
          employeeCode: 'STF001',
          departmentId: 'dep-1',
          department: { name: 'Cardiology' },
        }),
      },
      patient: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'patient-1',
          patientCode: 'PAT001',
          fullName: 'Patient Member',
        }),
      },
      visit: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'visit-1',
          visitCode: 'VIS001',
          patientId: 'patient-1',
          departmentId: 'dep-1',
          patient: { fullName: 'Patient Member', patientCode: 'PAT001' },
          department: { name: 'Cardiology' },
        }),
      },
      medicalConclusion: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
      department: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
    };
    const controller = new AuditController(
      {} as any,
      { getInclusionProof: jest.fn(), anchorNow: jest.fn() } as any,
      prisma as any,
      { recover: jest.fn() } as any,
    );
    return { controller, row };
  }

  it('lists readable diffs without raw encrypted snapshots', async () => {
    const { controller } = setup();

    const result = await controller.logs(undefined, undefined, undefined, undefined, undefined, { sub: 'admin-1', role: 'ADMIN' } as any);

    expect(result.total).toBe(1);
    expect(result.items[0]).toMatchObject({ blockchainStatus: 'PENDING', fieldsChanged: ['SENSITIVE_FIELD_CHANGED'] });
    expect(result.items[0].diff).toEqual([
      expect.objectContaining({ field: 'avatarUrl', before: '[REDACTED]', after: '[REDACTED]', redacted: true }),
      expect.objectContaining({ field: 'fullName', before: '[REDACTED]', after: '[REDACTED]', redacted: true }),
    ]);
    const item: any = result.items[0];
    expect(item.beforeEncrypted).toBeUndefined();
    expect(item.afterEncrypted).toBeUndefined();
  });

  it('returns detail verification without encrypted or decrypted snapshots', async () => {
    const { controller } = setup();

    const result: any = await controller.logDetail('1', { sub: 'admin-1', role: 'ADMIN' } as any);

    expect(result.verification).toMatchObject({ ok: true, status: 'VERIFIED', version: 'V2' });
    expect(result.encryptedSnapshots).toBeUndefined();
    expect(result.decryptedSnapshots).toBeUndefined();
    expect(JSON.stringify(result.diff)).not.toContain('cdn.example');
  });
});
