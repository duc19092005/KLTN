import { BadRequestException } from '@nestjs/common';
import { RateAiModelUseCase } from '../../../../../../../src/modules/ai-model/application/use-cases/rate-ai-model.use-case';

describe('RateAiModelUseCase', () => {
  it('rejects rating when the doctor never used the model on that diagnosis', async () => {
    const prisma = {
      aiModelRegistry: {
        findUnique: jest.fn().mockResolvedValue({ id: 'model-1', isDeleted: false, modelName: 'AI' }),
      },
      staffProfile: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'staff-1',
          fullName: 'BS A',
          doctorProfile: { id: 'doctor-1' },
        }),
      },
      aiDiagnosis: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'diag-1',
          aiModelId: 'model-1',
          reviewedByDoctorId: 'doctor-other',
          visitId: 'visit-1',
        }),
      },
      aiQuality: {
        findUnique: jest.fn(),
        create: jest.fn(),
      },
    };
    const audit = { hashSnapshot: jest.fn(), record: jest.fn() };
    const useCase = new RateAiModelUseCase(prisma as never, audit as never);

    await expect(
      useCase.execute('model-1', 'user-1', 'diag-1', true, 'ok'),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.aiQuality.create).not.toHaveBeenCalled();
  });
});
