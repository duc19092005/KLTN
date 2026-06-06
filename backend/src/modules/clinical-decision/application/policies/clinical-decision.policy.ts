import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { VisitStatus } from '@prisma/client';
import { ClinicalVisitInfo } from '../ports/clinical-decision.repository.port';

/**
 * Pure clinical-decision business rules, extracted verbatim from the former
 * ClinicalDecisionService (assertReadyForClinicalDecision + the ownership
 * checks inside ensureDoctorVisit). The AI-suggestion-only invariant is upheld
 * by the use cases: only createConclusion writes a MedicalConclusion.
 */
@Injectable()
export class ClinicalDecisionPolicy {
  /** Clinical decisions (AI analysis / conclusion) require lab results to be in. */
  assertReadyForClinicalDecision(status: VisitStatus | string): void {
    if (status === VisitStatus.WAITING_CONCLUSION || status === VisitStatus.COMPLETED) return;
    throw new BadRequestException('Cần đủ kết quả cận lâm sàng trước khi AI phân tích hoặc bác sĩ kết luận');
  }

  /** Doctors may only act on their own visits. Mirrors ensureDoctorVisit(). */
  assertDoctorOwnsVisit(visit: ClinicalVisitInfo | null, doctorId: string): ClinicalVisitInfo {
    if (!visit) throw new NotFoundException('Không tìm thấy lượt khám.');
    if (visit.doctorId !== doctorId) throw new BadRequestException('Bác sĩ chỉ được truy cập lượt khám do mình phụ trách.');
    return visit;
  }
}
