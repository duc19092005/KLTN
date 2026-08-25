import { AuditAnchorService } from '../../../../../../../src/infrastructure/audit';
import { AuditLoggerService } from '../../../../../../../src/infrastructure/audit';
import { computeAfterHashV2 } from '../../../../../../../src/infrastructure/audit';
import { PrismaService } from '../../../../../../../src/infrastructure/prisma/prisma.service';
import { buildUnifiedDoctorSnapshot } from '../../../../../../../src/modules/doctor/domain/doctor-snapshot';
import { BlockchainStaffIntegrityAnchor } from '../../../../../../../src/modules/staff/infrastructure/adapters/blockchain-staff-integrity.anchor';
import { buildStaffSnapshot } from '../../../../../../../src/modules/staff/domain/staff-snapshot';

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

function makeStaff() {
  return {
    id: 'staff-1',
    employeeCode: 'NV-0001',
    fullName: 'Nguyen Van A',
    phone: '0900000000',
    gender: 'Nam',
    citizenId: '012345678901',
    birthDate: new Date('1990-01-02T00:00:00.000Z'),
    address: 'Da Nang',
    avatarUrl: 'https://example.test/avatar.jpg',
    departmentId: 'dept-1',
    position: 'KTV can lam sang',
    dataSalt: 'salt-1',
    hash256: 'a'.repeat(64),
    doctorProfile: null,
  };
}

describe('BlockchainStaffIntegrityAnchor', () => {
  const originalAuditHashKey = process.env.AUDIT_HASH_KEY;

  beforeAll(() => {
    process.env.AUDIT_HASH_KEY = 'staff-doctor-integrity-test-key-32';
  });

  afterAll(() => {
    if (originalAuditHashKey === undefined) {
      delete process.env.AUDIT_HASH_KEY;
    } else {
      process.env.AUDIT_HASH_KEY = originalAuditHashKey;
    }
  });

  it('verifies an anchored non-doctor staff row by comparing the audited afterHash, not V2 dataHash', async () => {
    const staff = makeStaff();
    const afterHash = computeAfterHashV2('StaffProfile', staff.id, buildStaffSnapshot(staff));
    const latestLog = {
      seq: 12,
      afterHash,
      dataHash: 'b'.repeat(64),
      batchId: 3,
    };
    const prisma = makePrisma(latestLog, latestLog);
    const audit = makeAudit(staff.hash256);
    const auditAnchor = makeAuditAnchor();
    const adapter = new BlockchainStaffIntegrityAnchor(
      prisma as unknown as PrismaService,
      audit as unknown as AuditLoggerService,
      auditAnchor as unknown as AuditAnchorService,
    );

    const result = await adapter.evaluate(staff);

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

  it('treats a matching newest unanchored staff afterHash as pending instead of tampered', async () => {
    const staff = makeStaff();
    const afterHash = computeAfterHashV2('StaffProfile', staff.id, buildStaffSnapshot(staff));
    const latestUnanchoredLog = {
      seq: 13,
      afterHash,
      dataHash: 'c'.repeat(64),
      batchId: null,
    };
    const prisma = makePrisma(null, latestUnanchoredLog);
    const audit = makeAudit(staff.hash256);
    const auditAnchor = makeAuditAnchor();
    const adapter = new BlockchainStaffIntegrityAnchor(
      prisma as unknown as PrismaService,
      audit as unknown as AuditLoggerService,
      auditAnchor as unknown as AuditAnchorService,
    );

    const result = await adapter.evaluate(staff);

    expect(result.status).toBe('PENDING_ANCHOR');
    expect(result.dbMatches).toBe(true);
    expect(result.chainMatches).toBe(false);
    expect(auditAnchor.getInclusionProof).not.toHaveBeenCalled();
    expect(auditAnchor.sendTelegramAlert).not.toHaveBeenCalled();
  });

  it('uses the doctor audit afterHash when a staff row delegates to a linked doctor profile', async () => {
    const staff = {
      ...makeStaff(),
      doctorProfile: {
        id: 'doctor-1',
        staffProfileId: 'staff-1',
        specialty: 'Da lieu',
        licenseNumber: 'CCHN-001',
        qualification: 'CKI',
        yearsExperience: 4,
        dataSalt: 'doctor-salt',
        hash256: 'd'.repeat(64),
      },
    };
    const doctorWithStaff = {
      ...staff.doctorProfile,
      staffProfile: { ...staff, doctorProfile: undefined },
    };
    const afterHash = computeAfterHashV2('DoctorProfile', staff.doctorProfile.id, buildUnifiedDoctorSnapshot(doctorWithStaff));
    const latestLog = {
      seq: 20,
      afterHash,
      dataHash: 'e'.repeat(64),
      batchId: 4,
    };
    const prisma = makePrisma(latestLog, latestLog);
    const audit = makeAudit(staff.doctorProfile.hash256);
    const auditAnchor = makeAuditAnchor();
    const adapter = new BlockchainStaffIntegrityAnchor(
      prisma as unknown as PrismaService,
      audit as unknown as AuditLoggerService,
      auditAnchor as unknown as AuditAnchorService,
    );

    const result = await adapter.evaluate(staff);

    expect(result.status).toBe('VERIFIED');
    expect(result.dbMatches).toBe(true);
    expect(result.chainMatches).toBe(true);
    expect(result.onChainHash).toBe(afterHash);
    expect(auditAnchor.sendTelegramAlert).not.toHaveBeenCalled();
  });
});
