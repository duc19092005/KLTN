import { AuditArtifactService, AuditRecoveryBundleRow } from '../../../../../src/infrastructure/audit';
import { AuditRecoveryCryptoService } from '../../../../../src/infrastructure/audit';
import { AuditRecoveryService } from '../../../../../src/infrastructure/audit';
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
import { computeMerkleRoot, rootToBytes32 } from '../../../../../src/infrastructure/audit';

function buildRow(): AuditRecoveryBundleRow {
  const createdAt = '2026-07-20T02:00:00.000Z';
  const entity = 'Patient';
  const entityId = '11111111-1111-4111-8111-111111111111';
  const action = 'CREATE';
  const actorId = 'admin-1';
  const after = {
    patientCode: 'BN-0001', fullName: 'Nguyen Van A', gender: 'MALE',
    birthDate: '1990-01-01T00:00:00.000Z', citizenId: null, phone: '0900000000',
    address: null, insuranceNumber: null, emergencyContact: null,
  };
  const diffJson = buildAuditDiff(null, after);
  const beforeHash = computeBeforeHashV2(entity, entityId, null);
  const afterHash = computeAfterHashV2(entity, entityId, after);
  const diffHash = computeDiffHashV2(diffJson);
  const dataHash = computeDataHashV2({ entity, entityId, action, beforeHash, afterHash, diffHash, fieldsChanged: diffJson.fieldsChanged });
  const entryHash = computeEntryHashV2({
    seq: 1, prevHash: GENESIS_PREV_HASH, entity, entityId, action, actorId,
    beforeHash, afterHash, diffHash, dataHash, createdAtIso: createdAt,
  });
  const aad = buildAuditEncryptionAad({ seq: 1, entity, entityId, action, createdAtIso: createdAt });
  return {
    id: 'audit-1', eventId: 'event-1', seq: 1, prevHash: GENESIS_PREV_HASH, entryHash,
    actorId, action, entity, entityId, metadata: null, dataHash, dataSalt: null,
    beforeJson: null, afterJson: null, beforeHash, afterHash, diffHash, hashVersion: AUDIT_ENTRY_V2,
    beforeEncrypted: encryptAuditSnapshot(canonicalize(null), aad),
    afterEncrypted: encryptAuditSnapshot(canonicalize(after), aad),
    encryptionVersion: 'AES-256-GCM-V1', encryptionKeyId: 'audit-test-key',
    diffJson, fieldsChanged: diffJson.fieldsChanged,
    departmentId: null, staffProfileId: null, doctorProfileId: null, patientId: entityId,
    aiModelRegistryId: null, medicalConclusionId: null, aiQualityId: null, createdAt,
  };
}

describe('AuditRecoveryService verified IPFS reader', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.AUDIT_HASH_KEY = 'audit-recovery-service-test-hash-key';
    process.env.AUDIT_ENCRYPTION_KEY = '22'.repeat(32);
    process.env.AUDIT_ENCRYPTION_KEY_ID = 'audit-test-key';
    process.env.AUDIT_RECOVERY_ENCRYPTION_KEY = '44'.repeat(32);
    process.env.AUDIT_RECOVERY_ENCRYPTION_KEY_ID = 'recovery-test-key';
  });

  afterAll(() => { process.env = { ...originalEnv }; });

  async function setup(batchOverrides: Record<string, unknown> = {}) {
    const row = buildRow();
    const root = computeMerkleRoot([row.entryHash]);
    let stored = Buffer.alloc(0);
    const ipfs = {
      isReady: () => true,
      upload: jest.fn(async (bytes: Buffer) => {
        stored = Buffer.from(bytes);
        return { cid: 'bafy-verified-batch', uri: 'ipfs://bafy-verified-batch' };
      }),
      download: jest.fn(async () => Buffer.from(stored)),
    };
    const artifacts = new AuditArtifactService(new AuditRecoveryCryptoService(), ipfs as never);
    const uploaded = await artifacts.createAndUpload({
      schema: 'KLTN_AUDIT_RECOVERY_BUNDLE_V1',
      batch: { batchId: 1, merkleRoot: root, leafCount: 1, fromSeq: 1, toSeq: 1, algorithmVersion: 'MERKLE_SHA256_STRING_V1' },
      logs: [row],
    });
    const batch = {
      batchId: 1, status: 'ANCHORED', merkleRoot: root, leafCount: 1, fromSeq: 1, toSeq: 1,
      algorithmVersion: 'MERKLE_SHA256_STRING_V1', ...batchOverrides,
    };
    const prisma = { auditBatch: { findUnique: jest.fn().mockResolvedValue(batch) } };
    const blockchain = { getAuditCheckpoint: jest.fn().mockResolvedValue({
      committed: true, root: rootToBytes32(root), leafCount: 1, fromSeq: 1, toSeq: 1,
      artifactUri: uploaded.artifactUri, artifactHash: uploaded.artifactHash,
    }) };
    const service = new AuditRecoveryService(prisma as never, blockchain as never, artifacts, {} as never, {} as never);
    return { service, row, ipfs, corrupt: () => { stored[stored.length - 1] ^= 1; } };
  }

  it('decrypts and returns a bundle only after artifact, hash-chain and Merkle verification', async () => {
    const { service, row } = await setup();
    const result = await service.loadVerifiedBundle(1);

    expect(result.logs).toHaveLength(1);
    expect(result.logs[0].entryHash).toBe(row.entryHash);
    expect(result.artifactHash).toMatch(/^0x[0-9a-f]{64}$/);
  });

  it('rejects modified IPFS bytes before decrypting the recovery snapshot', async () => {
    const { service, corrupt } = await setup();
    corrupt();

    await expect(service.loadVerifiedBundle(1)).rejects.toThrow('artifact hash');
  });

  it('rejects a valid artifact when its Merkle root differs from the local anchored batch', async () => {
    const { service } = await setup({ merkleRoot: 'f'.repeat(64) });

    await expect(service.loadVerifiedBundle(1)).rejects.toThrow('Merkle root');
  });

  it('successfully loads verified bundle even when PostgreSQL AuditBatch is missing (DB Wipe scenario)', async () => {
    const { service, row } = await setup();
    // Simulate DB wipe: prisma.auditBatch.findUnique returns null
    (service['prisma'] as any).auditBatch.findUnique.mockResolvedValue(null);

    const result = await service.loadVerifiedBundle(1);
    expect(result.logs).toHaveLength(1);
    expect(result.logs[0].entryHash).toBe(row.entryHash);
    expect(result.batchId).toBe(1);
  });

  it('tracks deep scan progress and state', () => {
    const service = new AuditRecoveryService({} as never, {} as never, {} as never, {} as never, {} as never);
    const initialStatus = service.getDeepScanStatus();
    expect(initialStatus.active).toBe(false);
    expect(initialStatus.progressPercent).toBe(0);
  });
});
