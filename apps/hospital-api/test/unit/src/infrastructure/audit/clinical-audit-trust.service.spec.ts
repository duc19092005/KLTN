import { ConflictException } from '@nestjs/common';
import {
  AUDIT_ENTRY_V2,
  canonicalize,
  ClinicalAuditTrustService,
  computeAfterHashV2,
  computeBeforeHashV2,
  computeDataHashV2,
  computeDiffHashV2,
  computeEntryHashV2,
  GENESIS_PREV_HASH,
} from '../../../../../src/infrastructure/audit';
import { buildAuditDiff } from '../../../../../src/infrastructure/audit';
import { buildAuditEncryptionAad, encryptAuditSnapshot } from '../../../../../src/infrastructure/audit';

const VISIT_ID = '11111111-1111-4111-8111-111111111111';
const PATIENT_ID = '22222222-2222-4222-8222-222222222222';
const visitSnapshot = {
  visitCode: 'LK-0001', patientId: PATIENT_ID, departmentId: '33333333-3333-4333-8333-333333333333',
  staffId: null, status: 'WAITING', source: 'WALK_IN', checkInAt: '2026-08-25T03:00:00.000Z', completedAt: null,
};

function buildRow(
  seq: number,
  prevHash: string,
  overrides: Record<string, unknown> = {},
) {
  const base = {
    id: `audit-${seq}`, seq, prevHash, entity: 'Visit', entityId: VISIT_ID,
    action: 'CREATE', actorId: 'reception-1', createdAt: new Date(`2026-08-25T03:00:${String(seq).padStart(2, '0')}.000Z`),
  };
  const diffJson = buildAuditDiff(null, visitSnapshot);
  const fieldsChanged = diffJson.fieldsChanged;
  const beforeHash = computeBeforeHashV2(base.entity, base.entityId, null);
  const afterHash = computeAfterHashV2(base.entity, base.entityId, visitSnapshot);
  const diffHash = computeDiffHashV2(diffJson);
  const dataHash = computeDataHashV2({ ...base, beforeHash, afterHash, diffHash, fieldsChanged });
  const entryHash = computeEntryHashV2({ ...base, beforeHash, afterHash, diffHash, dataHash, createdAtIso: base.createdAt.toISOString() });
  const aad = buildAuditEncryptionAad({ seq, entity: base.entity, entityId: base.entityId, action: base.action, createdAtIso: base.createdAt.toISOString() });
  return {
    ...base, dataHash, beforeHash, afterHash, diffHash, hashVersion: AUDIT_ENTRY_V2,
    beforeEncrypted: encryptAuditSnapshot(canonicalize(null), aad),
    afterEncrypted: encryptAuditSnapshot(canonicalize(visitSnapshot), aad),
    diffJson, fieldsChanged, entryHash, onChainStatus: 'PENDING', batchId: null,
    ...overrides,
  };
}

function setup(rows: ReturnType<typeof buildRow>[], live = visitSnapshot) {
  const latest = rows[rows.length - 1];
  const calls: string[] = [];
  const tx = {
    $queryRaw: jest.fn().mockImplementation(async () => { calls.push('row-lock'); return [{ id: VISIT_ID }]; }),
    $executeRaw: jest.fn().mockImplementation(async () => { calls.push('audit-lock'); return 1; }),
    blockchainLogger: {
      findFirst: jest.fn().mockImplementation(async (args) => {
        if (args.where?.entity) return latest;
        if (typeof args.where?.seq === 'number') return rows.find((row) => row.seq === args.where.seq) ?? null;
        return null;
      }),
      findMany: jest.fn().mockImplementation(async (args) => rows.filter((row) =>
        row.seq >= args.where.seq.gte && row.seq <= args.where.seq.lte,
      )),
    },
    visit: { findUnique: jest.fn().mockResolvedValue({ id: VISIT_ID, ...live, checkInAt: new Date(live.checkInAt) }) },
  };
  const prisma = { $transaction: jest.fn().mockImplementation(async (callback) => callback(tx)) };
  const anchor = {
    getInclusionProof: jest.fn(),
    getLatestVerifiedCheckpointBefore: jest.fn().mockResolvedValue(null),
  };
  return { service: new ClinicalAuditTrustService(prisma as never, anchor as never), tx, anchor, calls };
}

function responseOf(error: unknown): Record<string, unknown> {
  expect(error).toBeInstanceOf(ConflictException);
  return (error as ConflictException).getResponse() as Record<string, unknown>;
}

describe('ClinicalAuditTrustService', () => {
  const originalHashKey = process.env.AUDIT_HASH_KEY;
  const originalEncryptionKey = process.env.AUDIT_ENCRYPTION_KEY;
  const originalEncryptionKeyId = process.env.AUDIT_ENCRYPTION_KEY_ID;

  beforeEach(() => {
    process.env.AUDIT_HASH_KEY = 'clinical-trust-test-hash-key-000001';
    process.env.AUDIT_ENCRYPTION_KEY = '33'.repeat(32);
    process.env.AUDIT_ENCRYPTION_KEY_ID = 'clinical-trust-test-key';
  });

  afterAll(() => {
    if (originalHashKey === undefined) delete process.env.AUDIT_HASH_KEY; else process.env.AUDIT_HASH_KEY = originalHashKey;
    if (originalEncryptionKey === undefined) delete process.env.AUDIT_ENCRYPTION_KEY; else process.env.AUDIT_ENCRYPTION_KEY = originalEncryptionKey;
    if (originalEncryptionKeyId === undefined) delete process.env.AUDIT_ENCRYPTION_KEY_ID; else process.env.AUDIT_ENCRYPTION_KEY_ID = originalEncryptionKeyId;
  });

  it('allows an anchored target only after inclusion proof and predecessor validation', async () => {
    const predecessor = buildRow(40, GENESIS_PREV_HASH);
    const target = buildRow(41, predecessor.entryHash, { onChainStatus: 'ANCHORED', batchId: 4 });
    const { service, anchor, calls } = setup([predecessor, target]);
    anchor.getInclusionProof.mockResolvedValue({ verified: true, batchId: 4, entryHash: target.entryHash });

    await expect(service.assertTrusted({ entity: 'Visit', entityId: VISIT_ID })).resolves.toMatchObject({
      targetSeq: 41, targetBatchId: 4, mode: 'ANCHORED_TARGET',
    });
    expect(anchor.getInclusionProof).toHaveBeenCalledWith(41, expect.anything());
    expect(calls).toEqual(['row-lock', 'audit-lock']);
  });

  it('blocks an anchored target when its immediate predecessor was tampered', async () => {
    const predecessor = buildRow(40, GENESIS_PREV_HASH, { dataHash: 'tampered' });
    const target = buildRow(41, predecessor.entryHash, { onChainStatus: 'ANCHORED', batchId: 4 });
    const { service, anchor } = setup([predecessor, target]);
    anchor.getInclusionProof.mockResolvedValue({ verified: true, batchId: 4, entryHash: target.entryHash });

    await expect(service.assertTrusted({ entity: 'Visit', entityId: VISIT_ID })).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'AUDIT_PREDECESSOR_INVALID' }),
    });
  });

  it('walks every unanchored row from the latest verified checkpoint to target seq', async () => {
    const checkpointHash = 'checkpoint-entry-hash';
    const row51 = buildRow(51, checkpointHash);
    const row52 = buildRow(52, row51.entryHash);
    const row53 = buildRow(53, row52.entryHash);
    const { service, anchor, tx } = setup([row51, row52, row53]);
    anchor.getLatestVerifiedCheckpointBefore.mockResolvedValue({ batchId: 3, fromSeq: 1, toSeq: 50, entryHash: checkpointHash });

    await expect(service.assertTrusted({ entity: 'Visit', entityId: VISIT_ID })).resolves.toMatchObject({
      checkpointSeq: 50, verifiedSuffixLength: 3, mode: 'CHECKPOINT_SUFFIX',
    });
    expect(tx.blockchainLogger.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { seq: { gte: 51, lte: 53 } },
    }));
  });

  it('blocks when the unanchored suffix contains a gap', async () => {
    const row51 = buildRow(51, 'checkpoint-entry-hash');
    const row53 = buildRow(53, row51.entryHash);
    const { service, anchor } = setup([row51, row53]);
    anchor.getLatestVerifiedCheckpointBefore.mockResolvedValue({ batchId: 3, fromSeq: 1, toSeq: 50, entryHash: 'checkpoint-entry-hash' });

    await expect(service.assertTrusted({ entity: 'Visit', entityId: VISIT_ID })).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'AUDIT_SUFFIX_GAP' }),
    });
  });

  it('blocks when a pending row was modified and its hashes recomputed incompletely', async () => {
    const row = buildRow(1, GENESIS_PREV_HASH, { afterHash: 'attacker-recomputed-value' });
    const { service } = setup([row]);

    await expect(service.assertTrusted({ entity: 'Visit', entityId: VISIT_ID })).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'AUDIT_TARGET_INVALID' }),
    });
  });

  it('blocks a valid audit chain when live Visit data was changed directly', async () => {
    const row = buildRow(1, GENESIS_PREV_HASH);
    const { service } = setup([row], { ...visitSnapshot, status: 'IN_PROGRESS' });

    let response: Record<string, unknown> = {};
    try { await service.assertTrusted({ entity: 'Visit', entityId: VISIT_ID }); } catch (error) { response = responseOf(error); }
    expect(response).toMatchObject({ code: 'ENTITY_LIVE_TAMPERED', suspiciousFields: ['INTEGRITY_PROTECTED_FIELD_CHANGED'] });
    expect(JSON.stringify(response)).not.toContain('IN_PROGRESS');
  });

  it('fails closed when the target has no audit source', async () => {
    const row = buildRow(1, GENESIS_PREV_HASH);
    const { service, tx } = setup([row]);
    tx.blockchainLogger.findFirst.mockResolvedValueOnce(null);

    await expect(service.assertTrusted({ entity: 'Visit', entityId: VISIT_ID })).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'AUDIT_TARGET_MISSING' }),
    });
  });

  it('fails closed for legacy audit rows on a protected clinical mutation', async () => {
    const row = buildRow(1, GENESIS_PREV_HASH, { hashVersion: 'AUDIT_ENTRY_V1' });
    const { service } = setup([row]);

    await expect(service.assertTrusted({ entity: 'Visit', entityId: VISIT_ID })).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'AUDIT_TARGET_INVALID' }),
    });
  });
});
