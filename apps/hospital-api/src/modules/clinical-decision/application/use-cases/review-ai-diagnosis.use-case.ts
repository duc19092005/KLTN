import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ReviewAiDiagnosisDto } from '../../dto/clinical-decision.dto';
import {
  CLINICAL_DECISION_REPOSITORY,
  ClinicalDecisionRepositoryPort,
} from '../ports/clinical-decision.repository.port';
import { ClinicalDecisionPolicy } from '../policies/clinical-decision.policy';
import { AuditLoggerService } from '../../../../infrastructure/audit';
import { buildAiDiagnosisSnapshot } from '../../domain/ai-diagnosis-snapshot';

/**
 * Doctor reviews an AI suggestion for a visit in their department. This only
 * flags DOCTOR_REVIEWED; it does not create a MedicalConclusion.
 */
@Injectable()
export class ReviewAiDiagnosisUseCase {
  constructor(
    @Inject(CLINICAL_DECISION_REPOSITORY) private readonly repo: ClinicalDecisionRepositoryPort,
    private readonly policy: ClinicalDecisionPolicy,
    private readonly audit: AuditLoggerService,
  ) {}

  async execute(id: string, dto: ReviewAiDiagnosisDto, doctorUserId: string) {
    const doctor = await this.repo.findDoctorByUserId(doctorUserId);
    if (!doctor) throw new BadRequestException('Tài khoản hiện tại không có hồ sơ bác sĩ.');

    const diagnosis = await this.repo.findAiDiagnosisWithVisit(id);
    if (!diagnosis) throw new NotFoundException('Không tìm thấy phân tích AI.');
    this.policy.assertDoctorOwnsVisit(diagnosis.visit, doctor);

    return this.repo.updateAiDiagnosisReview(id, doctor.id, dto.doctorFeedback?.trim() || null, async (before, after, tx) => {
      await this.audit.recordV2({
        entity: 'AiDiagnosis', entityId: id, action: 'UPDATE', actorId: doctorUserId,
        before: buildAiDiagnosisSnapshot(before), after: buildAiDiagnosisSnapshot(after),
      }, tx);
    });
  }
}
