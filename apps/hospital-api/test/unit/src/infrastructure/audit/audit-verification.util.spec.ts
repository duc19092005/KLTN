import {
  AUDIT_ENTRY_V2,
  canonicalize,
  computeAfterHashV2,
  computeBeforeHashV2,
  computeDataHashV2,
  computeDiffHashV2,
  computeEntryHash,
  computeEntryHashV2,
  GENESIS_PREV_HASH,
} from '../../../../../src/infrastructure/audit';
import { buildAuditDiff } from '../../../../../src/infrastructure/audit';
import { buildAuditEncryptionAad, encryptAuditSnapshot } from '../../../../../src/infrastructure/audit';
import { compareLiveSnapshotToAuditAfter, verifyAuditRow } from '../../../../../src/infrastructure/audit';

function buildV2Row(overrides: Record<string, unknown> = {}) {
  const rowBase = {
    seq: 1,
    prevHash: GENESIS_PREV_HASH,
    entity: 'StaffProfile',
    entityId: 'staff-1',
    action: 'UPDATE',
    actorId: 'admin-1',
    createdAt: new Date('2026-06-10T00:00:00.000Z'),
  };
  const before = { fullName: 'abc', avatarUrl: 'https://cdn.example/old.png' };
  const after = { fullName: 'def', avatarUrl: 'https://cdn.example/new.png' };
  const diffJson = buildAuditDiff(before, after);
  const fieldsChanged = diffJson.fieldsChanged;
  const beforeHash = computeBeforeHashV2(rowBase.entity, rowBase.entityId, before);
  const afterHash = computeAfterHashV2(rowBase.entity, rowBase.entityId, after);
  const diffHash = computeDiffHashV2(diffJson);
  const dataHash = computeDataHashV2({
    entity: rowBase.entity,
    entityId: rowBase.entityId,
    action: rowBase.action,
    beforeHash,
    afterHash,
    diffHash,
    fieldsChanged,
  });
  const entryHash = computeEntryHashV2({
    ...rowBase,
    beforeHash,
    afterHash,
    diffHash,
    dataHash,
    createdAtIso: rowBase.createdAt.toISOString(),
  });
  const aad = buildAuditEncryptionAad({
    seq: rowBase.seq,
    entity: rowBase.entity,
    entityId: rowBase.entityId,
    action: rowBase.action,
    createdAtIso: rowBase.createdAt.toISOString(),
  });

  return {
    ...rowBase,
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
    ...overrides,
  };
}

describe('audit-verification.util', () => {
  const originalHashKey = process.env.AUDIT_HASH_KEY;
  const originalEncryptionKey = process.env.AUDIT_ENCRYPTION_KEY;
  const originalEncryptionKeyId = process.env.AUDIT_ENCRYPTION_KEY_ID;

  beforeEach(() => {
    process.env.AUDIT_HASH_KEY = 'audit-hash-key-for-verification-tests';
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

  it('verifies a valid encrypted V2 row and decrypts raw snapshots', () => {
    const row = buildV2Row();

    const result = verifyAuditRow(row);

    expect(result).toMatchObject({ ok: true, status: 'VERIFIED', version: 'V2', reason: null, suspiciousFields: [] });
    expect(result.decryptedBefore).toEqual({ fullName: 'abc', avatarUrl: 'https://cdn.example/old.png' });
    expect(result.decryptedAfter).toEqual({ fullName: 'def', avatarUrl: 'https://cdn.example/new.png' });
  });

  it('detects tampered diffJson through diffHash mismatch', () => {
    const row = buildV2Row();

    const result = verifyAuditRow({ ...row, diffJson: { ...row.diffJson, fieldsChanged: ['fullName'] } });

    expect(result.ok).toBe(false);
    expect(result.status).toBe('TAMPERED');
    expect(result.suspiciousFields).toContain('diffJson');
    expect(result.suspiciousFields).toContain('diffHash');
  });

  it('detects tampered encrypted snapshots through AES-GCM authentication', () => {
    const row = buildV2Row();
    const beforeEncrypted = { ...(row.beforeEncrypted as any), ciphertext: `${(row.beforeEncrypted as any).ciphertext}AA` };

    const result = verifyAuditRow({ ...row, beforeEncrypted });

    expect(result.ok).toBe(false);
    expect(result.status).toBe('TAMPERED');
    expect(result.suspiciousFields).toEqual(['beforeEncrypted', 'afterEncrypted']);
  });

  it('detects live DB tampering and reports suspicious fields', () => {
    const row = buildV2Row();

    const result = compareLiveSnapshotToAuditAfter(row, { fullName: 'xyz', avatarUrl: 'https://cdn.example/new.png' });

    expect(result.ok).toBe(false);
    expect(result.status).toBe('TAMPERED');
    expect(result.reason).toBe('Live DB snapshot does not match latest audited afterHash');
    expect(result.suspiciousFields).toEqual(['fullName']);
  });

  it('keeps V1 row verification available for legacy audit rows', () => {
    const createdAt = new Date('2026-06-10T00:00:00.000Z');
    const dataHash = 'a'.repeat(64);
    const entryHash = computeEntryHash(
      {
        seq: 1,
        actorId: 'admin-1',
        action: 'CREATE',
        entity: 'Department',
        entityId: 'dept-1',
        dataHash,
        createdAtIso: createdAt.toISOString(),
      },
      GENESIS_PREV_HASH,
    );

    expect(
      verifyAuditRow({
        seq: 1,
        prevHash: GENESIS_PREV_HASH,
        entryHash,
        actorId: 'admin-1',
        action: 'CREATE',
        entity: 'Department',
        entityId: 'dept-1',
        dataHash,
        createdAt,
      }),
    ).toMatchObject({ ok: true, status: 'VERIFIED', version: 'V1' });
  });
});
