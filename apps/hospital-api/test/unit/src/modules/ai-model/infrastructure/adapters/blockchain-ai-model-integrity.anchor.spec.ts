import { AuditAnchorService } from '../../../../../../../src/infrastructure/audit/audit-anchor.service';
import { AuditLoggerService } from '../../../../../../../src/infrastructure/audit/audit-logger.service';
import { computeAfterHashV2 } from '../../../../../../../src/infrastructure/audit/audit-hash.util';
import { PrismaService } from '../../../../../../../src/infrastructure/prisma/prisma.service';
import { buildAiModelSnapshot } from '../../../../../../../src/modules/ai-model/domain/ai-model-snapshot';
import { BlockchainAiModelIntegrityAnchor } from '../../../../../../../src/modules/ai-model/infrastructure/adapters/blockchain-ai-model-integrity.anchor';

type LatestLog = {
  seq: number;
  afterHash: string;
  dataHash: string;
  batchId: number | null;
} | null;

function makePrisma(...logs: LatestLog[]) {
  const findFirst = jest.fn();
  logs.forEach((log) => findFirst.mockResolvedValueOnce(log));
  findFirst.mockResolvedValue(logs[logs.length - 1] ?? null);
  return {
    aiModelRegistry: { update: jest.fn().mockResolvedValue({}) },
    blockchainLogger: { findFirst },
  };
}

function makeAudit(storedHash: string) {
  return {
    hashSnapshot: jest.fn().mockReturnValue({ salt: 'salt-1', hash: storedHash }),
    recompute: jest.fn().mockReturnValue(storedHash),
    recordV2: jest.fn().mockResolvedValue({}),
  };
}

function makeAuditAnchor() {
  return {
    getInclusionProof: jest.fn().mockResolvedValue({ verified: true }),
    sendTelegramAlert: jest.fn().mockResolvedValue(undefined),
  };
}

function makeModel(overrides: Record<string, unknown> = {}) {
  return {
    id: 'model-1',
    modelName: 'ChatGPT',
    modelVersion: 'gpt-5.2',
    recommendedSpecialty: 'Tong quat',
    type: 'API',
    provider: 'chatgpt',
    apiEndpoint: 'https://api.openai.com/v1/chat/completions',
    ipHashPlain: 'f'.repeat(64),
    description: 'Assistant',
    createdBy: 'admin-1',
    dataSalt: 'salt-1',
    hash256: 'a'.repeat(64),
    isDeleted: false,
    ...overrides,
  };
}

describe('BlockchainAiModelIntegrityAnchor', () => {
  const originalAuditHashKey = process.env.AUDIT_HASH_KEY;

  beforeAll(() => {
    process.env.AUDIT_HASH_KEY = 'ai-model-integrity-anchor-test-key-32';
  });

  afterAll(() => {
    if (originalAuditHashKey === undefined) {
      delete process.env.AUDIT_HASH_KEY;
    } else {
      process.env.AUDIT_HASH_KEY = originalAuditHashKey;
    }
  });

  it('verifies an anchored AI model by comparing the audited afterHash, not V2 dataHash', async () => {
    const model = makeModel();
    const afterHash = computeAfterHashV2('AiModelRegistry', model.id, buildAiModelSnapshot(model));
    const latestLog = {
      seq: 31,
      afterHash,
      dataHash: 'b'.repeat(64),
      batchId: 6,
    };
    const prisma = makePrisma(latestLog, latestLog);
    const audit = makeAudit(model.hash256);
    const auditAnchor = makeAuditAnchor();
    const adapter = new BlockchainAiModelIntegrityAnchor(
      prisma as unknown as PrismaService,
      audit as unknown as AuditLoggerService,
      auditAnchor as unknown as AuditAnchorService,
    );

    const result = await adapter.evaluate(model);

    expect(result.status).toBe('VERIFIED');
    expect(result.dbMatches).toBe(true);
    expect(result.chainMatches).toBe(true);
    expect(result.onChainHash).toBe(afterHash);
    expect(auditAnchor.sendTelegramAlert).not.toHaveBeenCalled();
  });

  it('treats a matching newest unanchored AI model afterHash as pending instead of tampered', async () => {
    const model = makeModel();
    const afterHash = computeAfterHashV2('AiModelRegistry', model.id, buildAiModelSnapshot(model));
    const latestUnanchoredLog = {
      seq: 32,
      afterHash,
      dataHash: 'c'.repeat(64),
      batchId: null,
    };
    const prisma = makePrisma(null, latestUnanchoredLog);
    const audit = makeAudit(model.hash256);
    const auditAnchor = makeAuditAnchor();
    const adapter = new BlockchainAiModelIntegrityAnchor(
      prisma as unknown as PrismaService,
      audit as unknown as AuditLoggerService,
      auditAnchor as unknown as AuditAnchorService,
    );

    const result = await adapter.evaluate(model);

    expect(result.status).toBe('PENDING_ANCHOR');
    expect(result.dbMatches).toBe(true);
    expect(result.chainMatches).toBe(false);
    expect(auditAnchor.getInclusionProof).not.toHaveBeenCalled();
    expect(auditAnchor.sendTelegramAlert).not.toHaveBeenCalled();
  });

  it('anchors a soft delete with an after snapshot that includes isDeleted=true', async () => {
    const model = makeModel({ isDeleted: true });
    const prisma = makePrisma();
    const audit = makeAudit(model.hash256);
    const auditAnchor = makeAuditAnchor();
    const adapter = new BlockchainAiModelIntegrityAnchor(
      prisma as unknown as PrismaService,
      audit as unknown as AuditLoggerService,
      auditAnchor as unknown as AuditAnchorService,
    );

    await adapter.anchorChange(model, 'DELETE', 'admin-1', buildAiModelSnapshot(makeModel()));

    expect(prisma.aiModelRegistry.update).toHaveBeenCalledWith({
      where: { id: model.id },
      data: { hash256: model.hash256, dataSalt: 'salt-1' },
    });
    expect(audit.recordV2).toHaveBeenCalledWith(expect.objectContaining({
      action: 'DELETE',
      after: expect.objectContaining({ isDeleted: true }),
    }), undefined);
  });
});
