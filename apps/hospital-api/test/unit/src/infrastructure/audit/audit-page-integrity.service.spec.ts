import {
  AuditPageIntegrityService,
  GENESIS_PREV_HASH,
  MERKLE_SHA256_STRING_V1,
  computeDataHashV2,
  computeEntryHashV2,
  computeMerkleRootForAlgorithm,
} from '../../../../../src/infrastructure/audit';

const HASH_KEY = 'unit-test-audit-hash-key-at-least-32-characters';

type RowOptions = { seq: number; entityId: string; afterHash: string; batchId: number; prevHash?: string };

function row(options: RowOptions) {
  const createdAt = new Date(`2026-01-01T00:00:${String(options.seq).padStart(2, '0')}.000Z`);
  const base = {
    seq: options.seq,
    prevHash: options.prevHash ?? GENESIS_PREV_HASH,
    actorId: null,
    action: 'CREATE',
    entity: 'Department',
    entityId: options.entityId,
    beforeHash: null,
    afterHash: options.afterHash,
    diffHash: null,
    hashVersion: 'V2',
    fieldsChanged: [],
    batchId: options.batchId,
    createdAt,
  };
  const dataHash = computeDataHashV2(base, HASH_KEY);
  const entryHash = computeEntryHashV2({ ...base, dataHash, createdAtIso: createdAt.toISOString() });
  return { ...base, dataHash, entryHash };
}

describe('AuditPageIntegrityService', () => {
  beforeAll(() => { process.env.AUDIT_HASH_KEY = HASH_KEY; });

  it('rejects pages larger than ten entities', async () => {
    const service = new AuditPageIntegrityService({} as any, {} as any);
    const targets = Array.from({ length: 11 }, (_, index) => ({
      id: String(index), entity: 'Department', entityId: String(index), currentAfterHash: `hash-${index}`,
    }));
    await expect(service.evaluate(targets)).rejects.toThrow('AUDIT_PAGE_SIZE_EXCEEDED');
  });

  it('groups ten rows in one batch into one on-chain RPC and reuses the cache', async () => {
    const rows: any[] = [];
    for (let seq = 1; seq <= 10; seq += 1) {
      rows.push(row({ seq, entityId: `dept-${seq}`, afterHash: `after-${seq}`, batchId: 7, prevHash: rows[seq - 2]?.entryHash }));
    }
    const root = computeMerkleRootForAlgorithm(rows.map((item) => item.entryHash), MERKLE_SHA256_STRING_V1);
    const prisma = {
      blockchainLogger: {
        findMany: jest.fn().mockImplementation(({ where }: any) => where.OR ? rows.slice().reverse() : rows),
      },
      auditBatch: {
        findMany: jest.fn().mockResolvedValue([{ batchId: 7, merkleRoot: root, leafCount: 10, fromSeq: 1, toSeq: 10, status: 'ANCHORED', algorithmVersion: MERKLE_SHA256_STRING_V1 }]),
      },
    };
    const blockchain = {
      getAuditCheckpoint: jest.fn().mockResolvedValue({ committed: true, root: `0x${root}`, leafCount: 10, fromSeq: 1, toSeq: 10 }),
    };
    const service = new AuditPageIntegrityService(prisma as any, blockchain as any);
    const targets = rows.map((item) => ({ id: item.entityId, entity: item.entity, entityId: item.entityId, currentAfterHash: item.afterHash }));

    const first = await service.evaluate(targets);
    const second = await service.evaluate(targets);

    expect([...first.values()].every((item) => item.status === 'VERIFIED')).toBe(true);
    expect([...second.values()].every((item) => item.status === 'VERIFIED')).toBe(true);
    expect(blockchain.getAuditCheckpoint).toHaveBeenCalledTimes(1);
  });

  it('returns VERIFICATION_UNAVAILABLE instead of TAMPERED when RPC fails', async () => {
    const auditRow = row({ seq: 1, entityId: 'dept-1', afterHash: 'after-1', batchId: 9 });
    const root = computeMerkleRootForAlgorithm([auditRow.entryHash], MERKLE_SHA256_STRING_V1);
    const prisma = {
      blockchainLogger: { findMany: jest.fn().mockImplementation(({ where }: any) => where.OR ? [auditRow] : [auditRow]) },
      auditBatch: { findMany: jest.fn().mockResolvedValue([{ batchId: 9, merkleRoot: root, leafCount: 1, fromSeq: 1, toSeq: 1, status: 'ANCHORED', algorithmVersion: MERKLE_SHA256_STRING_V1 }]) },
    };
    const blockchain = { getAuditCheckpoint: jest.fn().mockRejectedValue(new Error('Sepolia RPC timeout')) };
    const service = new AuditPageIntegrityService(prisma as any, blockchain as any);

    const result = await service.evaluate([{ id: 'dept-1', entity: 'Department', entityId: 'dept-1', currentAfterHash: 'after-1' }]);

    expect(result.get('dept-1')?.status).toBe('VERIFICATION_UNAVAILABLE');
    expect(result.get('dept-1')?.chainMatches).toBe(false);
  });
});
