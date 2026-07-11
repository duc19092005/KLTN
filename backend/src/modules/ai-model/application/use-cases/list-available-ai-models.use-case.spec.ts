import { ListAvailableAiModelsUseCase } from './list-available-ai-models.use-case';

describe('ListAvailableAiModelsUseCase', () => {
  it('returns only the clinical selection fields and calculated reliability', async () => {
    const repo = {
      findAvailableForDiagnosis: jest.fn().mockResolvedValue([{
        id: 'model-1',
        modelName: 'Clinical Assistant',
        modelVersion: '1.0',
        recommendedSpecialty: 'Tim mạch',
        status: 'ACTIVE',
        apiEndpoint: 'https://secret-provider.example/v1',
        ipHashEncrypted: 'ciphertext',
        aiQualities: [{ trustablePercent: 100 }, { trustablePercent: 80 }],
      }]),
    };
    const useCase = new ListAvailableAiModelsUseCase(repo as never);

    const result = await useCase.execute();
    expect(result).toEqual([{
      id: 'model-1',
      name: 'Clinical Assistant',
      version: '1.0',
      recommendedSpecialty: 'Tim mạch',
      status: 'ACTIVE',
      reliability: 90,
    }]);
    expect(JSON.stringify(result)).not.toContain('secret-provider');
    expect(JSON.stringify(result)).not.toContain('ciphertext');
  });
});
