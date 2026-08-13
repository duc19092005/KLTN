import { AuditController } from '../../../../../../src/modules/audit/controllers/audit.controller';
import {
  AUDIT_ENTRY_V2,
  canonicalize,
  computeAfterHashV2,
  computeBeforeHashV2,
  computeDataHashV2,
  computeDiffHashV2,
  computeEntryHashV2,
  GENESIS_PREV_HASH,
} from '../../../../../../src/infrastructure/audit/audit-hash.util';
import { buildAuditDiff } from '../../../../../../src/infrastructure/audit/audit-diff.util';
import { buildAuditEncryptionAad, encryptAuditSnapshot } from '../../../../../../src/infrastructure/audit/audit-encryption.util';

function buildV2Row(options: {
  id?: string;
  seq?: number;
  prevHash?: string;
  entityId?: string;
  createdAt?: Date;
  batchId?: number | null;
} = {}) {
  const base = {
    id: options.id ?? 'log-1',
    seq: options.seq ?? 1,
    prevHash: options.prevHash ?? GENESIS_PREV_HASH,
    entity: 'StaffProfile',
    entityId: options.entityId ?? 'staff-1',
    action: 'UPDATE',
    actorId: 'admin-1',
    createdAt: options.createdAt ?? new Date('2026-06-10T00:00:00.000Z'),
    onChainStatus: 'PENDING',
    txHash: null,
    blockNumber: null,
    batchId: options.batchId ?? null,
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
      { listWarnings: jest.fn(), recoverMany: jest.fn() } as any,
      {} as any,
    );
    return { controller, row };
  }

  it('lists readable diffs without raw encrypted snapshots', async () => {
    const { controller } = setup();

    const result = await controller.logs(undefined, undefined, undefined, undefined, undefined, { sub: 'admin-1', role: 'ADMIN' } as any);

    expect(result.total).toBe(1);
    expect(result.items[0]).toMatchObject({ blockchainStatus: 'VERIFIED', fieldsChanged: ['SENSITIVE_FIELD_CHANGED'] });
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
describe('AuditController incomplete audit batch regression', () => {
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

  it('does not report 0/0 or missing hashes when an ARTIFACT_READY batch has three valid pending logs in its seq range', async () => {
    let previousHash = 'ab'.repeat(32);
    const pendingRows = [22, 23, 24].map((seq) => {
      const row = buildV2Row({
        id: `log-${seq}`,
        seq,
        prevHash: previousHash,
        entityId: `staff-${seq}`,
        createdAt: new Date(`2026-08-01T07:40:${seq}.000Z`),
        batchId: null,
      });
      previousHash = row.entryHash;
      return row;
    });

    const batch = {
      id: 'batch-row-17',
      batchId: 17,
      merkleRoot: 'cd'.repeat(32),
      leafCount: 3,
      fromSeq: 22,
      toSeq: 24,
      status: 'ARTIFACT_READY',
      algorithmVersion: 'MERKLE_SHA256_BYTES32_V2',
      contractVersion: 'AUDIT_ANCHOR_CHECKPOINT_V2',
      artifactHash: 'ef'.repeat(32),
      artifactUri: 'ipfs://encrypted-artifact-17',
      txHash: null,
      blockNumber: null,
      error: 'Blockchain checkpoint commit failed.',
      createdAt: new Date('2026-08-01T07:40:42.000Z'),
      anchoredAt: null,
      recoveredAt: null,
    };

    const prisma = {
      auditBatch: {
        findMany: jest.fn().mockResolvedValue([batch]),
        count: jest.fn().mockResolvedValue(1),
      },
      blockchainLogger: {
        findMany: jest.fn().mockImplementation(({ where }: any) => {
          if (where?.batchId?.in) {
            return Promise.resolve(
              pendingRows.filter((row) => row.batchId != null && where.batchId.in.includes(row.batchId)),
            );
          }
          if (where?.seq) {
            return Promise.resolve(
              pendingRows.filter((row) => row.seq >= where.seq.gte && row.seq <= where.seq.lte),
            );
          }
          return Promise.resolve(pendingRows);
        }),
      },
      staffProfile: {
        findMany: jest.fn().mockImplementation(({ where }: any) => Promise.resolve(
          pendingRows
            .filter((row) => where.id.in.includes(row.entityId))
            .map((row) => ({ employeeCode: `NV-${row.seq}`, fullName: `Nhan vien ${row.seq}` })),
        )),
      },
    };

    const controller = new AuditController(
      {} as any,
      {} as any,
      prisma as any,
      {} as any,
      {} as any,
      {} as any,
    );

    const result = await controller.batches('1', '10', 'batchId', 'desc');

    expect(result.items[0]).toMatchObject({
      batchId: 17,
      leafCount: 3,
      fromSeq: 22,
      toSeq: 24,
      status: 'ARTIFACT_READY',
      contentSummary: [expect.objectContaining({ entity: 'StaffProfile', count: 3 })],
      integrity: {
        status: 'VERIFIED',
        verified: 3,
        tampered: 0,
        pending: 0,
        total: 3,
      },
    });
  });
});
