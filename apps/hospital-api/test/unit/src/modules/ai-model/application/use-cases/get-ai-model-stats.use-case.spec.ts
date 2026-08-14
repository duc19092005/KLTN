import { GetAiModelStatsUseCase } from '../../../../../../../src/modules/ai-model/application/use-cases/get-ai-model-stats.use-case';
import { buildAiQualitySnapshot } from '../../../../../../../src/modules/ai-model/domain/ai-quality-snapshot';

describe('GetAiModelStatsUseCase', () => {
  it('correctly evaluates quality integrity using canonical buildAiQualitySnapshot', async () => {
    const quality = {
      id: 'quality-1',
      doctorId: 'doctor-1',
      aiModelId: 'model-1',
      aiDiagnosisId: 'diag-1',
      doctorConclusionAboutModel: 'Very accurate',
      trustablePercent: 100,
      dataSalt: 'salt-1',
      hash256: 'recomputed-hash-1',
      createdAt: new Date('2026-08-01T00:00:00Z'),
      doctor: {
        staffProfile: {
          fullName: 'Bac Si A',
        },
      },
    };

    const prisma = {
      aiModelRegistry: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'model-1',
            modelName: 'AI Diagnoser',
            modelVersion: '1.0.0',
            recommendedSpecialty: 'CARDIOLOGY',
            provider: 'OpenAI',
            isDeleted: false,
            aiQualities: [quality],
          },
        ]),
      },
      blockchainLogger: {
        findFirst: jest.fn().mockResolvedValue({
          seq: 42,
          batchId: 5,
          afterHash: 'chain-hash-1',
        }),
      },
    };

    const audit = {
      recompute: jest.fn().mockImplementation((snapshot, salt) => {
        expect(snapshot).toEqual(buildAiQualitySnapshot(quality));
        expect(snapshot.aiDiagnosisId).toBe('diag-1');
        return 'recomputed-hash-1';
      }),
    };

    const auditAnchor = {
      getInclusionProof: jest.fn().mockResolvedValue({ verified: true }),
    };

    const useCase = new GetAiModelStatsUseCase(prisma as never, audit as never, auditAnchor as never);
    const stats = await useCase.execute();

    expect(stats.allModels).toHaveLength(1);
    expect(stats.allModels[0].totalRatings).toBe(1);
    expect(stats.allModels[0].positiveRatings).toBe(1);
    expect(stats.allModels[0].averageAccuracy).toBe(100);
    expect(audit.recompute).toHaveBeenCalledTimes(1);
  });
});
