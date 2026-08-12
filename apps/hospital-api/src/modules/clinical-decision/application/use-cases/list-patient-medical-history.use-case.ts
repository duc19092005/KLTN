import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ClinicalDecisionPolicy } from '../policies/clinical-decision.policy';
import {
  CLINICAL_DECISION_REPOSITORY,
  ClinicalDecisionRepositoryPort,
} from '../ports/clinical-decision.repository.port';

@Injectable()
export class ListPatientMedicalHistoryUseCase {
  constructor(
    @Inject(CLINICAL_DECISION_REPOSITORY) private readonly repo: ClinicalDecisionRepositoryPort,
    private readonly policy: ClinicalDecisionPolicy,
  ) {}

  async execute(patientId: string, currentVisitId: string, doctorUserId: string) {
    const doctor = await this.repo.findDoctorByUserId(doctorUserId);
    if (!doctor) throw new BadRequestException('Tài khoản hiện tại không có hồ sơ bác sĩ.');

    const visit = this.policy.assertDoctorOwnsVisit(await this.repo.findVisitById(currentVisitId), doctor);
    if (visit.patientId !== patientId) throw new NotFoundException('Không tìm thấy bệnh án của bệnh nhân trong lượt khám này.');

    return this.repo.findPatientMedicalHistory(patientId, currentVisitId);
  }
}
