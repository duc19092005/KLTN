import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { CreateMedicalConclusionDto } from '../../dto/clinical-decision.dto';
import { ClinicalDecisionPolicy } from '../policies/clinical-decision.policy';
import {
  CLINICAL_DECISION_REPOSITORY,
  ClinicalDecisionRepositoryPort,
} from '../ports/clinical-decision.repository.port';

/**
 * Doctor finalizes a visit with a MedicalConclusion. Behavior copied verbatim
 * from the former ClinicalDecisionService.createConclusion(): doctor ownership,
 * readiness check, optional AI-diagnosis linkage validation, and the atomic
 * conclusion upsert + visit COMPLETED transition.
 *
 * Invariant: only this use case (a DOCTOR action) writes a MedicalConclusion.
 * AI suggestions never finalize a visit.
 */
@Injectable()
export class CreateMedicalConclusionUseCase {
  constructor(
    @Inject(CLINICAL_DECISION_REPOSITORY) private readonly repo: ClinicalDecisionRepositoryPort,
    private readonly policy: ClinicalDecisionPolicy,
  ) {}

  async execute(dto: CreateMedicalConclusionDto, doctorUserId: string) {
    const doctor = await this.repo.findDoctorByUserId(doctorUserId);
    if (!doctor) throw new BadRequestException('Current user does not have doctor profile');

    const visit = await this.repo.findVisitById(dto.visitId);
    this.policy.assertDoctorOwnsVisit(visit, doctor.id);
    this.policy.assertReadyForClinicalDecision(visit!.status);

    if (dto.aiDiagnosisId) {
      const aiDiagnosis = await this.repo.findAiDiagnosisById(dto.aiDiagnosisId);
      if (!aiDiagnosis || aiDiagnosis.visitId !== visit!.id) {
        throw new BadRequestException('AI diagnosis does not belong to this visit');
      }
    }

    return this.repo.upsertConclusionAndCompleteVisit({
      visitId: visit!.id,
      doctorId: visit!.doctorId,
      aiDiagnosisId: dto.aiDiagnosisId || null,
      finalDiagnosis: dto.finalDiagnosis.trim(),
      treatmentPlan: dto.treatmentPlan?.trim() || null,
      prescription: dto.prescription?.trim() || null,
      followUpNote: dto.followUpNote?.trim() || null,
      doctorNote: dto.doctorNote?.trim() || null,
    });
  }
}
