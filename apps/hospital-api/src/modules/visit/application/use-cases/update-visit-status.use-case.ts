import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { UserRole, VisitStatus } from '@prisma/client';
import { AuthUser } from '../../../../common/types/auth-user.type';
import { ClinicalAuditTrustService } from '../../../../infrastructure/audit';
import { VisitTransitionPolicy } from '../policies/visit-transition.policy';
import { VISIT_REPOSITORY, VisitRepositoryPort } from '../ports/visit.repository.port';
import { buildVisitSnapshot } from '../../domain/visit-snapshot';
import {
  VISIT_INTEGRITY_ANCHOR,
  VisitIntegrityAnchorPort,
} from '../ports/visit-integrity-anchor.port';

/**
 * Direct status transition workflow for PATCH /visits/:id/status.
 * A doctor is scoped to their department and claims an unassigned visit by
 * writing their StaffProfile id to Visit.staffId.
 */
@Injectable()
export class UpdateVisitStatusUseCase {
  constructor(
    @Inject(VISIT_REPOSITORY) private readonly repo: VisitRepositoryPort,
    private readonly transitionPolicy: VisitTransitionPolicy,
    @Inject(VISIT_INTEGRITY_ANCHOR) private readonly integrity: VisitIntegrityAnchorPort,
    private readonly clinicalTrust: ClinicalAuditTrustService,
  ) {}

  async execute(input: { id: string; status: VisitStatus; user?: AuthUser }) {
    const { id, status, user } = input;
    const visit = await this.repo.findById(id);
    if (!visit) throw new NotFoundException('Không tìm thấy lượt khám.');

    let assignedStaffId: string | undefined;
    if (user?.role === UserRole.DOCTOR) {
      const doctor = await this.repo.findDoctorStaffByUserId(user.sub);
      if (!doctor) throw new ForbiddenException('Tài khoản hiện tại không có hồ sơ bác sĩ.');
      if (!doctor.departmentId || visit.departmentId !== doctor.departmentId) {
        throw new ForbiddenException('Bác sĩ chỉ có thể cập nhật lượt khám trong phòng ban của mình.');
      }
      // Allow doctor to claim a WAITING visit in their department; once IN_PROGRESS, lock to assigned doctor.
      if (visit.staffId && visit.staffId !== doctor.staffId && visit.status !== VisitStatus.WAITING) {
        throw new ForbiddenException('Lượt khám này đã được bác sĩ khác phụ trách.');
      }
      assignedStaffId = doctor.staffId;
    }

    if (status === VisitStatus.CANCELLED) {
      this.transitionPolicy.ensureCanCancel(visit, user);
    }

    this.transitionPolicy.assertTransitionAllowed(visit.status, status);

    const previousSnapshot = buildVisitSnapshot(visit);
    const completedAt =
      status === VisitStatus.COMPLETED || status === VisitStatus.CANCELLED ? new Date() : undefined;
    const result = await this.repo.updateStatus(
      id,
      status,
      completedAt,
      assignedStaffId,
      async (updatedVisit, tx) => {
        await this.integrity.anchorChange(
          updatedVisit,
          'UPDATE',
          user?.sub ?? null,
          previousSnapshot,
          tx,
        );
      },
      async (tx) => {
        await this.clinicalTrust.assertManyTrusted([
          { entity: 'Visit', entityId: id },
          { entity: 'Patient', entityId: visit.patientId },
        ], tx);
      },
    );

    return result;
  }
}
