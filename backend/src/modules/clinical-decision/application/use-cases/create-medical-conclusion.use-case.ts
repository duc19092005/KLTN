import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { CreateMedicalConclusionDto } from '../../dto/clinical-decision.dto';
import { ClinicalDecisionPolicy } from '../policies/clinical-decision.policy';
import {
  CLINICAL_DECISION_REPOSITORY,
  ClinicalDecisionRepositoryPort,
} from '../ports/clinical-decision.repository.port';
import {
  MEDICAL_CONCLUSION_INTEGRITY_ANCHOR,
  MedicalConclusionIntegrityAnchorPort,
} from '../ports/medical-conclusion-integrity-anchor.port';
import { buildMedicalConclusionSnapshot } from '../../domain/medical-conclusion-snapshot';

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
    @Inject(MEDICAL_CONCLUSION_INTEGRITY_ANCHOR) private readonly integrity: MedicalConclusionIntegrityAnchorPort,
    private readonly policy: ClinicalDecisionPolicy,
  ) {}

  async execute(dto: CreateMedicalConclusionDto, doctorUserId: string) {
    const doctor = await this.repo.findDoctorByUserId(doctorUserId);
    if (!doctor) throw new BadRequestException('Tài khoản hiện tại không có hồ sơ bác sĩ.');

    const visit = await this.repo.findVisitById(dto.visitId);
    this.policy.assertDoctorOwnsVisit(visit, doctor.id);
    this.policy.assertReadyForClinicalDecision(visit!.status);

    if (dto.aiDiagnosisId) {
      const aiDiagnosis = await this.repo.findAiDiagnosisById(dto.aiDiagnosisId);
      if (!aiDiagnosis || aiDiagnosis.visitId !== visit!.id) {
        throw new BadRequestException('Phân tích AI không thuộc lượt khám này.');
      }
    }

    const existing = await this.repo.findConclusionByVisitId(dto.visitId);
    const before = existing ? buildMedicalConclusionSnapshot(existing) : null;
    const action = existing ? 'UPDATE' : 'CREATE';

    const conclusion = await this.repo.upsertConclusionAndCompleteVisit({
      visitId: visit!.id,
      doctorId: visit!.doctorId,
      aiDiagnosisId: dto.aiDiagnosisId || null,
      finalDiagnosis: dto.finalDiagnosis.trim(),
      treatmentPlan: dto.treatmentPlan?.trim() || null,
      prescription: dto.prescription?.trim() || null,
      followUpNote: dto.followUpNote?.trim() || null,
      doctorNote: dto.doctorNote?.trim() || null,
    });

    await this.integrity.anchorChange(conclusion, action, doctorUserId, before);

    return conclusion;
  }
}
