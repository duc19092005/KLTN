import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { ClinicalDecisionPolicy } from '../policies/clinical-decision.policy';
import {
  CLINICAL_DECISION_REPOSITORY,
  ClinicalDecisionRepositoryPort,
} from '../ports/clinical-decision.repository.port';

/**
 * Returns the full visit (with results, AI diagnoses, conclusion) for the
 * owning doctor. Mirrors the former ClinicalDecisionService.getVisitResults().
 */
@Injectable()
export class GetVisitResultsUseCase {
  constructor(
    @Inject(CLINICAL_DECISION_REPOSITORY) private readonly repo: ClinicalDecisionRepositoryPort,
    private readonly policy: ClinicalDecisionPolicy,
  ) {}

  async execute(visitId: string, doctorUserId: string) {
    const doctor = await this.repo.findDoctorByUserId(doctorUserId);
    if (!doctor) throw new BadRequestException('Tài khoản hiện tại không có hồ sơ bác sĩ.');

    const visit = await this.repo.findVisitById(visitId);
    this.policy.assertDoctorOwnsVisit(visit, doctor.id);

    return this.repo.findFullVisit(visitId);
  }
}
