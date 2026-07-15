import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { VisitStatus } from '@prisma/client';
import { ClinicalDoctor, ClinicalVisitInfo } from '../ports/clinical-decision.repository.port';

/**
 * Pure clinical-decision business rules. AI suggestions never finalize a visit;
 * only the conclusion use case writes MedicalConclusion.
 */
@Injectable()
export class ClinicalDecisionPolicy {
  /** Clinical decisions require lab results to be in. */
  assertReadyForClinicalDecision(status: VisitStatus | string): void {
    if (status === VisitStatus.WAITING_CONCLUSION || status === VisitStatus.COMPLETED) return;
    throw new BadRequestException('Cần đủ kết quả cận lâm sàng trước khi AI phân tích hoặc bác sĩ kết luận');
  }

  /** Doctors may only act on visits in their department, unless already claimed by another doctor. */
  assertDoctorOwnsVisit(visit: ClinicalVisitInfo | null, doctor: ClinicalDoctor): ClinicalVisitInfo {
    if (!visit) throw new NotFoundException('Không tìm thấy lượt khám.');
    if (!doctor.departmentId || visit.departmentId !== doctor.departmentId) {
      throw new BadRequestException('Bác sĩ chỉ được truy cập lượt khám trong phòng ban của mình.');
    }
    if (visit.staffId && visit.staffId !== doctor.staffId) {
      throw new BadRequestException('Lượt khám này đã được bác sĩ khác phụ trách.');
    }
    return visit;
  }
}
