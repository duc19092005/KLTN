import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { UserRole, VisitStatus } from '@prisma/client';
import { AuthUser } from '../../../../common/types/auth-user.type';
import { VisitTransitionPolicy } from '../policies/visit-transition.policy';
import { VISIT_REPOSITORY, VisitRepositoryPort } from '../ports/visit.repository.port';

/**
 * Direct status transition workflow for PATCH /visits/:id/status.
 * Sequence preserved from the former VisitService.updateStatus():
 * doctor ownership -> cancel rule -> transition validation -> persist.
 */
@Injectable()
export class UpdateVisitStatusUseCase {
  constructor(
    @Inject(VISIT_REPOSITORY) private readonly repo: VisitRepositoryPort,
    private readonly transitionPolicy: VisitTransitionPolicy,
  ) {}

  async execute(input: { id: string; status: VisitStatus; user?: AuthUser }) {
    const { id, status, user } = input;
    const visit = await this.repo.findById(id);
    if (!visit) throw new NotFoundException('Visit not found');

    if (user?.role === UserRole.DOCTOR) {
      const doctorId = await this.repo.findDoctorIdByUserId(user.sub);
      if (!doctorId) throw new ForbiddenException('Current user does not have doctor profile');
      if (visit.doctorId !== doctorId) {
        throw new ForbiddenException('Doctor can only update status for own visit');
      }
    }

    if (status === VisitStatus.CANCELLED) {
      this.transitionPolicy.ensureCanCancel(visit, user);
    }

    this.transitionPolicy.assertTransitionAllowed(visit.status, status);

    const completedAt =
      status === VisitStatus.COMPLETED || status === VisitStatus.CANCELLED ? new Date() : undefined;
    return this.repo.updateStatus(id, status, completedAt);
  }
}
