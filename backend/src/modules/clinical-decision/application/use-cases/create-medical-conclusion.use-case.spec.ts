import { BadRequestException } from '@nestjs/common';
import { MedicalOrderStatus } from '@prisma/client';
import { CreateMedicalConclusionUseCase } from './create-medical-conclusion.use-case';
import { ClinicalDecisionPolicy } from '../policies/clinical-decision.policy';

describe('CreateMedicalConclusionUseCase integration rules', () => {
  const doctorUserId = 'doctor-user-1';
  const visitId = 'visit-1';

  function makeUseCase(pendingOrders: number) {
    const repo = {
      findDoctorByUserId: jest.fn().mockResolvedValue({ id: 'doctor-1', specialty: 'General' }),
      findVisitById: jest.fn().mockResolvedValue({ id: visitId, doctorId: 'doctor-1', status: 'WAITING_CONCLUSION' }),
      countPendingMedicalOrders: jest.fn().mockResolvedValue(pendingOrders),
      findAiDiagnosisById: jest.fn(),
      findConclusionByVisitId: jest.fn(),
      upsertConclusionAndCompleteVisit: jest.fn().mockResolvedValue({ id: 'conclusion-1', visitId }),
    };
    const integrity = { anchorChange: jest.fn().mockResolvedValue(undefined) };
    const useCase = new CreateMedicalConclusionUseCase(
      repo as any,
      integrity as any,
      new ClinicalDecisionPolicy(),
    );
    return { useCase, repo, integrity };
  }

  it('blocks final conclusion when one of two medical orders is still pending', async () => {
    const { useCase, repo, integrity } = makeUseCase(1);

    await expect(
      useCase.execute(
        {
          visitId,
          finalDiagnosis: 'Viêm phổi',
          treatmentPlan: 'Theo dõi và điều trị',
        } as any,
        doctorUserId,
      ),
    ).rejects.toThrow(BadRequestException);

    await expect(
      useCase.execute(
        {
          visitId,
          finalDiagnosis: 'Viêm phổi',
        } as any,
        doctorUserId,
      ),
    ).rejects.toThrow('Còn 1 phiếu chỉ định chưa có kết quả');

    expect(repo.countPendingMedicalOrders).toHaveBeenCalledWith(visitId);
    expect(repo.upsertConclusionAndCompleteVisit).not.toHaveBeenCalled();
    expect(integrity.anchorChange).not.toHaveBeenCalled();
  });

  it('allows final conclusion only when all non-cancelled orders are RESULT_READY', async () => {
    const { useCase, repo, integrity } = makeUseCase(0);

    await expect(
      useCase.execute(
        {
          visitId,
          finalDiagnosis: 'Đủ kết quả xét nghiệm và hình ảnh',
          treatmentPlan: 'Điều trị ngoại trú',
        } as any,
        doctorUserId,
      ),
    ).resolves.toEqual({ id: 'conclusion-1', visitId });

    expect(repo.upsertConclusionAndCompleteVisit).toHaveBeenCalledTimes(1);
    expect(integrity.anchorChange).toHaveBeenCalledTimes(1);
  });

  it('documents the two-order scenario: one RESULT_READY and one PENDING yields one blocking order', () => {
    const statuses = [MedicalOrderStatus.RESULT_READY, MedicalOrderStatus.ORDERED];
    const pending = statuses.filter((status) => ![MedicalOrderStatus.CANCELLED, MedicalOrderStatus.RESULT_READY].includes(status)).length;
    expect(pending).toBe(1);
  });
});
