import { AuditAnchorService } from '../../../../../../../src/infrastructure/audit';
import { AuditLoggerService } from '../../../../../../../src/infrastructure/audit';
import { computeAfterHashV2 } from '../../../../../../../src/infrastructure/audit';
import { PrismaService } from '../../../../../../../src/infrastructure/prisma/prisma.service';
import { buildUnifiedDoctorSnapshot } from '../../../../../../../src/modules/doctor/domain/doctor-snapshot';
import { BlockchainDoctorIntegrityAnchor } from '../../../../../../../src/modules/doctor/infrastructure/adapters/blockchain-doctor-integrity.anchor';

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
  return { blockchainLogger: { findFirst } };
}

function makeAudit(storedHash: string) {
  return { recompute: jest.fn().mockReturnValue(storedHash) };
}

function makeAuditAnchor() {
  return {
    getInclusionProof: jest.fn().mockResolvedValue({ verified: true }),
    sendTelegramAlert: jest.fn().mockResolvedValue(undefined),
  };
}

function makeDoctor() {
  return {
    id: 'doctor-1',
    staffProfileId: 'staff-1',
    specialty: 'Da lieu',
    licenseNumber: 'CCHN-001',
    qualification: 'CKI',
    yearsExperience: 4,
    dataSalt: 'doctor-salt',
    hash256: 'd'.repeat(64),
    staffProfile: {
      id: 'staff-1',
      employeeCode: 'BS-0001',
      fullName: 'Nguyen Van B',
      phone: '0911111111',
      gender: 'Nam',
      citizenId: '111111111111',
      birthDate: new Date('1988-03-04T00:00:00.000Z'),
      address: 'Ho Chi Minh',
      avatarUrl: 'https://example.test/doctor.jpg',
      departmentId: 'dept-1',
      position: 'Bac si',
    },
  };
}

describe('BlockchainDoctorIntegrityAnchor', () => {
  const originalAuditHashKey = process.env.AUDIT_HASH_KEY;

  beforeAll(() => {
    process.env.AUDIT_HASH_KEY = 'doctor-integrity-anchor-test-key-32';
  });

  afterAll(() => {
    if (originalAuditHashKey === undefined) {
      delete process.env.AUDIT_HASH_KEY;
    } else {
      process.env.AUDIT_HASH_KEY = originalAuditHashKey;
    }
  });

  it('verifies an anchored doctor row by comparing the audited afterHash, not V2 dataHash', async () => {
    const doctor = makeDoctor();
    const afterHash = computeAfterHashV2('DoctorProfile', doctor.id, buildUnifiedDoctorSnapshot(doctor));
    const latestLog = {
      seq: 21,
      afterHash,
      dataHash: 'e'.repeat(64),
      batchId: 5,
    };
    const prisma = makePrisma(latestLog, latestLog);
    const audit = makeAudit(doctor.hash256);
    const auditAnchor = makeAuditAnchor();
    const adapter = new BlockchainDoctorIntegrityAnchor(
      prisma as unknown as PrismaService,
      audit as unknown as AuditLoggerService,
      auditAnchor as unknown as AuditAnchorService,
    );

    const result = await adapter.evaluate(doctor);

    expect(result.status).toBe('VERIFIED');
    expect(result.dbMatches).toBe(true);
    expect(result.chainMatches).toBe(true);
    expect(result.onChainHash).toBe(afterHash);
    expect(auditAnchor.sendTelegramAlert).not.toHaveBeenCalled();
    expect(prisma.blockchainLogger.findFirst).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        select: expect.objectContaining({ afterHash: true }),
      }),
    );
  });
});
