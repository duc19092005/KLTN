import { VerifyPatientPublicUseCase } from '../../../../../../../src/modules/patient/application/use-cases/verify-patient-public.use-case';
import { computeAfterHashV2 } from '../../../../../../../src/infrastructure/audit';
import { buildMedicalConclusionSnapshot } from '../../../../../../../src/modules/clinical-decision/domain/medical-conclusion-snapshot';

describe('VerifyPatientPublicUseCase', () => {
  const originalAuditHashKey = process.env.AUDIT_HASH_KEY;

  beforeAll(() => {
    process.env.AUDIT_HASH_KEY = 'verify-patient-public-use-case-test-key-32';
  });

  afterAll(() => {
    if (originalAuditHashKey === undefined) {
      delete process.env.AUDIT_HASH_KEY;
    } else {
      process.env.AUDIT_HASH_KEY = originalAuditHashKey;
    }
  });

  it('verifies an anchored medical conclusion using afterHash from BlockchainLogger and computeAfterHashV2', async () => {
    const conclusion = {
      id: 'conc-1',
      visitId: 'visit-1',
      doctorId: 'doc-1',
      finalDiagnosis: 'Viêm họng cấp',
      treatmentPlan: 'Nghỉ ngơi, uống nhiều nước',
      prescription: 'Paracetamol 500mg',
      doctorNote: 'Tái khám sau 3 ngày',
      concludedAt: new Date('2026-08-10T10:00:00.000Z'),
      hash256: 'c'.repeat(64),
      dataSalt: 'conc-salt',
      visit: {
        id: 'visit-1',
        patient: { id: 'pat-1', patientCode: 'BN-0001', fullName: 'Nguyen Van A' },
      },
    };

    const snapshot = buildMedicalConclusionSnapshot(conclusion);
    const afterHash = computeAfterHashV2('MedicalConclusion', conclusion.id, snapshot);

    const latestLog = {
      seq: 42,
      afterHash,
      dataHash: 'hmac-data-hash-value',
      batchId: 3,
      txHash: '0xabc123',
      createdAt: new Date('2026-08-10T10:05:00.000Z'),
    };

    const repo = {
      findByPatientCode: jest.fn(),
    };

    const integrity = {
      evaluate: jest.fn().mockResolvedValue({
        id: 'pat-1',
        patientCode: 'BN-0001',
        fullName: 'Nguyen Van A',
        status: 'VERIFIED',
        dbMatches: true,
        chainMatches: true,
      }),
    };

    const prisma = {
      medicalConclusion: {
        findUnique: jest.fn().mockResolvedValue(conclusion),
      },
      blockchainLogger: {
        findFirst: jest.fn().mockResolvedValue(latestLog),
      },
    };

    const auditAnchor = {
      getInclusionProof: jest.fn().mockResolvedValue({
        verified: true,
        onChainRoot: '0xroot123',
        proof: ['0xproof1'],
      }),
    };

    const auditLogger = {
      recompute: jest.fn().mockReturnValue(conclusion.hash256),
    };

    const useCase = new VerifyPatientPublicUseCase(
      repo as any,
      integrity as any,
      prisma as any,
      auditAnchor as any,
      auditLogger as any,
    );

    const result = await useCase.verifyConclusion('conc-1');

    expect(result.status).toBe('VERIFIED');
    expect(result.dbMatches).toBe(true);
    expect(result.chainMatches).toBe(true);
    expect(result.batchId).toBe(3);
    expect(result.txHash).toBe('0xabc123');
    expect(result.proofDetails).toEqual({
      seq: 42,
      batchId: 3,
      afterHash,
      onChainRoot: '0xroot123',
      proof: ['0xproof1'],
    });
  });
});
