import { BadRequestException } from '@nestjs/common';
import { MedicalOrderStatus } from '@prisma/client';
import { CreateMedicalConclusionUseCase } from '../../../../../../../src/modules/clinical-decision/application/use-cases/create-medical-conclusion.use-case';
import { ClinicalDecisionPolicy } from '../../../../../../../src/modules/clinical-decision/application/policies/clinical-decision.policy';
import { ListPatientMedicalHistoryUseCase } from '../../../../../../../src/modules/clinical-decision/application/use-cases/list-patient-medical-history.use-case';

describe('CreateMedicalConclusionUseCase integration rules', () => {
  const doctorUserId = 'doctor-user-1';
  const visitId = 'visit-1';

  function makeUseCase(pendingOrders: number) {
    const repo = {
      findDoctorByUserId: jest.fn().mockResolvedValue({ id: 'doctor-1', staffId: 'staff-1', departmentId: 'dept-1', specialty: 'General' }),
      findVisitById: jest.fn().mockResolvedValue({ id: visitId, patientId: 'patient-1', departmentId: 'dept-1', staffId: 'staff-1', status: 'WAITING_CONCLUSION' }),
      countPendingMedicalOrders: jest.fn().mockResolvedValue(pendingOrders),
      findAiDiagnosisById: jest.fn(),
      findConclusionByVisitId: jest.fn(),
      upsertConclusionAndCompleteVisit: jest.fn().mockImplementation(async (_data, afterWrite) => {
        const conclusion = { id: 'conclusion-1', visitId };
        await afterWrite?.(conclusion, {});
        return conclusion;
      }),
    };
    const integrity = {
      anchorChange: jest.fn().mockResolvedValue(undefined),
      triggerImmediateAnchor: jest.fn().mockResolvedValue(undefined),
    };
    const visitIntegrity = { anchorChange: jest.fn().mockResolvedValue(undefined) };
    const useCase = new CreateMedicalConclusionUseCase(
      repo as any,
      integrity as any,
      new ClinicalDecisionPolicy(),
      visitIntegrity as any,
      { assertManyTrusted: jest.fn().mockResolvedValue([]), assertTrusted: jest.fn().mockResolvedValue(undefined) } as any,
    );
    return { useCase, repo, integrity, visitIntegrity };
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
    const statuses: MedicalOrderStatus[] = [MedicalOrderStatus.RESULT_READY, MedicalOrderStatus.ORDERED];
    const readyStatuses: MedicalOrderStatus[] = [MedicalOrderStatus.CANCELLED, MedicalOrderStatus.RESULT_READY];
    const pending = statuses.filter((status) => !readyStatuses.includes(status)).length;
    expect(pending).toBe(1);
  });
});

describe('ListPatientMedicalHistoryUseCase access', () => {
  const doctor = { id: 'doctor-1', staffId: 'staff-1', departmentId: 'dept-1', specialty: 'General' };
  const currentVisit = { id: 'visit-1', patientId: 'patient-1', departmentId: 'dept-1', staffId: 'staff-1', status: 'IN_PROGRESS' };

  it('returns prior history after authorizing the current patient visit', async () => {
    const repo = {
      findDoctorByUserId: jest.fn().mockResolvedValue(doctor),
      findVisitById: jest.fn().mockResolvedValue(currentVisit),
      findPatientMedicalHistory: jest.fn().mockResolvedValue([{ id: 'visit-old' }]),
    };
    const useCase = new ListPatientMedicalHistoryUseCase(repo as any, new ClinicalDecisionPolicy());

    await expect(useCase.execute(currentVisit.patientId, currentVisit.id, 'doctor-user-1')).resolves.toEqual([{ id: 'visit-old' }]);
    expect(repo.findPatientMedicalHistory).toHaveBeenCalledWith(currentVisit.patientId, currentVisit.id);
  });

  it.each([
    ['another patient', { ...currentVisit }, 'patient-other', 'Không tìm thấy bệnh án của bệnh nhân trong lượt khám này.'],
    ['another doctor', { ...currentVisit, staffId: 'staff-other' }, currentVisit.patientId, 'Lượt khám này đã được bác sĩ khác phụ trách.'],
  ])('does not query history for %s', async (_case, visit, patientId, message) => {
    const repo = {
      findDoctorByUserId: jest.fn().mockResolvedValue(doctor),
      findVisitById: jest.fn().mockResolvedValue(visit),
      findPatientMedicalHistory: jest.fn(),
    };
    const useCase = new ListPatientMedicalHistoryUseCase(repo as any, new ClinicalDecisionPolicy());

    await expect(useCase.execute(patientId, currentVisit.id, 'doctor-user-1')).rejects.toThrow(message);
    expect(repo.findPatientMedicalHistory).not.toHaveBeenCalled();
  });
});
