import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ReviewAiDiagnosisDto } from '../../dto/clinical-decision.dto';
import {
  CLINICAL_DECISION_REPOSITORY,
  ClinicalDecisionRepositoryPort,
} from '../ports/clinical-decision.repository.port';

/**
 * Doctor reviews (annotates) an AI suggestion for their own visit. Behavior
 * copied verbatim from the former ClinicalDecisionService.reviewAiDiagnosis().
 * This only flags DOCTOR_REVIEWED; it does not create a MedicalConclusion.
 */
@Injectable()
export class ReviewAiDiagnosisUseCase {
  constructor(
    @Inject(CLINICAL_DECISION_REPOSITORY) private readonly repo: ClinicalDecisionRepositoryPort,
  ) {}

  async execute(id: string, dto: ReviewAiDiagnosisDto, doctorUserId: string) {
    const doctor = await this.repo.findDoctorByUserId(doctorUserId);
    if (!doctor) throw new BadRequestException('Tài khoản hiện tại không có hồ sơ bác sĩ.');

    const diagnosis = await this.repo.findAiDiagnosisWithVisit(id);
    if (!diagnosis) throw new NotFoundException('Không tìm thấy phân tích AI.');
    if (!diagnosis.visit || diagnosis.visit.doctorId !== doctor.id) {
      throw new BadRequestException('Bác sĩ chỉ được đánh giá phân tích AI của lượt khám do mình phụ trách.');
    }

    return this.repo.updateAiDiagnosisReview(id, doctor.id, dto.doctorFeedback?.trim() || null);
  }
}
