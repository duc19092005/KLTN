import { AuditAnchorService } from '../../../../../../../src/infrastructure/audit';
import { AuditLoggerService } from '../../../../../../../src/infrastructure/audit';
import { computeAfterHashV2 } from '../../../../../../../src/infrastructure/audit';
import { PrismaService } from '../../../../../../../src/infrastructure/prisma/prisma.service';
import { buildPatientSnapshot } from '../../../../../../../src/modules/patient/domain/patient-snapshot';
import { AuditPatientIntegrityAnchor } from '../../../../../../../src/modules/patient/infrastructure/adapters/audit-patient-integrity.anchor';

function makePatient() {
  return {
    id: 'patient-1',
    patientCode: 'BN-0001',
    fullName: 'Nguyen Van A',
    gender: 'Nam',
    birthDate: new Date('1990-01-01T00:00:00.000Z'),
    citizenId: '123456789012',
    phoneNumber: '0901234567',
    insuranceNumber: 'DN4791234567890',
    address: '123 Le Loi, TP.HCM',
    dataSalt: 'patient-salt',
    hash256: 'p'.repeat(64),
  };
}

describe('AuditPatientIntegrityAnchor', () => {
  const originalAuditHashKey = process.env.AUDIT_HASH_KEY;

  beforeAll(() => {
    process.env.AUDIT_HASH_KEY = 'patient-integrity-anchor-test-key-32';
  });

  afterAll(() => {
    if (originalAuditHashKey === undefined) {
      delete process.env.AUDIT_HASH_KEY;
    } else {
      process.env.AUDIT_HASH_KEY = originalAuditHashKey;
    }
  });

  it('verifies an anchored patient row by comparing afterHash with computeAfterHashV2, not V2 dataHash', async () => {
    const patient = makePatient();
    const afterHash = computeAfterHashV2('Patient', patient.id, buildPatientSnapshot(patient));
    const latestLog = {
      seq: 15,
      afterHash,
      dataHash: 'data-hash-envelope-value',
      batchId: 2,
    };

    const findFirst = jest.fn()
      .mockResolvedValueOnce(latestLog) // latestAnchored
      .mockResolvedValueOnce(latestLog); // latestAny

    const prisma = {
      blockchainLogger: { findFirst },
      patient: { update: jest.fn() },
    };

    const audit = {
      recompute: jest.fn().mockReturnValue(patient.hash256),
      hashSnapshot: jest.fn().mockReturnValue({ salt: patient.dataSalt, hash: patient.hash256 }),
      recordV2: jest.fn().mockResolvedValue({}),
      history: jest.fn(),
    };

    const auditAnchor = {
      getInclusionProof: jest.fn().mockResolvedValue({ verified: true }),
      sendTelegramAlert: jest.fn().mockResolvedValue(undefined),
    };

    const adapter = new AuditPatientIntegrityAnchor(
      prisma as unknown as PrismaService,
      audit as unknown as AuditLoggerService,
      auditAnchor as unknown as AuditAnchorService,
    );

    const result = await adapter.evaluate(patient);

    expect(result.status).toBe('VERIFIED');
    expect(result.dbMatches).toBe(true);
    expect(result.chainMatches).toBe(true);
    expect(result.recomputedHash).toBe(patient.hash256);
    expect(auditAnchor.sendTelegramAlert).not.toHaveBeenCalled();
    expect(prisma.blockchainLogger.findFirst).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        select: expect.objectContaining({ afterHash: true }),
      }),
    );
  });
});
