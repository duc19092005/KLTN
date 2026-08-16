import { Test } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { AuditLoggerService } from '../../../../../src/infrastructure/audit/audit-logger.service';
import { AuditAnchorService } from '../../../../../src/infrastructure/audit/audit-anchor.service';
import { PrismaService } from '../../../../../src/infrastructure/prisma/prisma.service';
import { AUDIT_ENTRY_V2 } from '../../../../../src/infrastructure/audit/audit-hash.util';
import { buildAuditEncryptionAad, decryptAuditSnapshot } from '../../../../../src/infrastructure/audit/audit-encryption.util';

function createPrismaMock() {
  const rows: any[] = [];
  const client = {
    $executeRaw: jest.fn().mockResolvedValue(undefined),
    blockchainLogger: {
      findFirst: jest.fn(async () => {
        const tail = rows.filter((row) => row.seq != null).sort((a, b) => b.seq - a.seq)[0];
        return tail ? { seq: tail.seq, entryHash: tail.entryHash } : null;
      }),
      create: jest.fn(async ({ data }: { data: any }) => {
        const row = { id: data.id ?? `log-${rows.length + 1}`, ...data };
        rows.push(row);
        return row;
      }),
      findMany: jest.fn(async () => rows),
    },
    auditBatch: {
      aggregate: jest.fn().mockResolvedValue({ _max: { toSeq: null } }),
    },
  };
  return {
    rows,
    client,
    prisma: {
      $transaction: jest.fn((callback: (tx: any) => Promise<unknown>) => callback(client)),
      blockchainLogger: client.blockchainLogger,
      auditBatch: client.auditBatch,
    },
  };
}

describe('AuditLoggerService V2', () => {
  const originalHashKey = process.env.AUDIT_HASH_KEY;
  const originalEncryptionKey = process.env.AUDIT_ENCRYPTION_KEY;
  const originalEncryptionKeyId = process.env.AUDIT_ENCRYPTION_KEY_ID;

  beforeEach(() => {
    process.env.AUDIT_HASH_KEY = 'audit-hash-key-for-service-tests';
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
    jest.clearAllMocks();
  });

  async function createService() {
    const prismaMock = createPrismaMock();
    const moduleRef = await Test.createTestingModule({
      providers: [
        AuditLoggerService,
        { provide: PrismaService, useValue: prismaMock.prisma },
        {
          provide: AuditAnchorService,
          useValue: {
            sendTelegramAlert: jest.fn(),
            getLatestCheckpointBatchId: jest.fn().mockResolvedValue(0),
            getCheckpointSequenceRange: jest.fn().mockResolvedValue(null),
          },
        },
      ],
    }).compile();

    return { service: moduleRef.get(AuditLoggerService), prismaMock };
  }

  it('writes encrypted V2 audit rows without hashing ciphertext', async () => {
    const { service, prismaMock } = await createService();

    const row: any = await service.record({
      entity: 'StaffProfile',
      entityId: 'staff-1',
      action: 'UPDATE',
      actorId: 'admin-1',
      before: { fullName: 'abc', avatarUrl: 'https://cdn.example/old.png' },
      after: { fullName: 'def', avatarUrl: 'https://cdn.example/new.png' },
      metadata: { reason: 'profile-edit' },
    });

    expect(prismaMock.prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(row.seq).toBe(1);
    expect(row.prevHash).toBe('0'.repeat(64));
    expect(row.hashVersion).toBe(AUDIT_ENTRY_V2);
    expect(row.dataSalt).toBeNull();
    expect(row.beforeHash).toMatch(/^[0-9a-f]{64}$/);
    expect(row.afterHash).toMatch(/^[0-9a-f]{64}$/);
    expect(row.diffHash).toMatch(/^[0-9a-f]{64}$/);
    expect(row.dataHash).toMatch(/^[0-9a-f]{64}$/);
    expect(row.entryHash).toMatch(/^[0-9a-f]{64}$/);
    expect(row.encryptionVersion).toBe('AUDIT_AES_256_GCM_V1');
    expect(row.encryptionKeyId).toBe('audit-key-test');
    expect(row.fieldsChanged).toEqual(['avatarUrl', 'fullName']);
    expect(row.diffJson.changes).toEqual([
      {
        field: 'avatarUrl',
        label: 'Ảnh đại diện',
        before: '[REDACTED]',
        after: '[REDACTED]',
        sensitivity: 'FILE_URL',
        storedRedacted: true,
      },
      {
        field: 'fullName',
        label: 'Họ tên',
        before: '[REDACTED]',
        after: '[REDACTED]',
        sensitivity: 'PII',
        storedRedacted: true,
      },
    ]);
    expect(JSON.stringify(row.diffJson)).not.toContain('cdn.example');
    expect(JSON.stringify(row.beforeEncrypted)).not.toContain('abc');
    expect(JSON.stringify(row.afterEncrypted)).not.toContain('def');

    const aad = buildAuditEncryptionAad({
      seq: row.seq,
      entity: row.entity,
      entityId: row.entityId,
      action: row.action,
      createdAtIso: row.createdAt.toISOString(),
    });
    expect(decryptAuditSnapshot(row.beforeEncrypted, aad)).toBe(
      '{"avatarUrl":"https://cdn.example/old.png","fullName":"abc"}',
    );
    expect(decryptAuditSnapshot(row.afterEncrypted, aad)).toBe(
      '{"avatarUrl":"https://cdn.example/new.png","fullName":"def"}',
    );
  });

  it('writes V2 rows through the canonical record path', async () => {
    const { service } = await createService();

    const row: any = await service.record({
      entity: 'Department',
      entityId: 'dept-1',
      action: 'CREATE',
      actorId: 'admin-1',
      dataHash: 'a'.repeat(64),
      before: null,
      after: { id: 'dept-1', name: 'Cardiology' },
    });

    expect(row.hashVersion).toBe(AUDIT_ENTRY_V2);
    expect(row.beforeEncrypted).toBeDefined();
    expect(row.afterEncrypted).toBeDefined();
    expect(row.dataSalt).toBeNull();
    expect(row.entryHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('uses caller transaction for V2 records when provided', async () => {
    const { service, prismaMock } = await createService();

    await service.recordV2(
      {
        entity: 'StaffProfile',
        entityId: 'staff-1',
        action: 'UPDATE',
        before: { fullName: 'abc' },
        after: { fullName: 'def' },
      },
      prismaMock.client as unknown as Prisma.TransactionClient,
    );

    expect(prismaMock.prisma.$transaction).not.toHaveBeenCalled();
    expect(prismaMock.client.blockchainLogger.create).toHaveBeenCalledTimes(1);
  });
});
