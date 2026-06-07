import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { UserRole, VisitStatus } from '@prisma/client';
import { AuthUser } from '../../../../common/types/auth-user.type';
import { AuditLoggerService } from '../../../../infrastructure/audit/audit-logger.service';
import { VisitTransitionPolicy } from '../policies/visit-transition.policy';
import { VISIT_REPOSITORY, VisitRepositoryPort } from '../ports/visit.repository.port';

/**
 * Direct status transition workflow for PATCH /visits/:id/status.
 * Sequence preserved from the former VisitService.updateStatus():
 * doctor ownership -> cancel rule -> transition validation -> persist -> audit log.
 */
@Injectable()
export class UpdateVisitStatusUseCase {
  constructor(
    @Inject(VISIT_REPOSITORY) private readonly repo: VisitRepositoryPort,
    private readonly transitionPolicy: VisitTransitionPolicy,
    private readonly auditLogger: AuditLoggerService,
  ) {}

  async execute(input: { id: string; status: VisitStatus; user?: AuthUser }) {
    const { id, status, user } = input;
    const visit = await this.repo.findById(id);
    if (!visit) throw new NotFoundException('Không tìm thấy lượt khám.');

    if (user?.role === UserRole.DOCTOR) {
      const doctorId = await this.repo.findDoctorIdByUserId(user.sub);
      if (!doctorId) throw new ForbiddenException('Tài khoản hiện tại không có hồ sơ bác sĩ.');
      if (visit.doctorId !== doctorId) {
        throw new ForbiddenException('Bác sĩ chỉ có thể cập nhật lượt khám do mình phụ trách.');
      }
    }

    if (status === VisitStatus.CANCELLED) {
      this.transitionPolicy.ensureCanCancel(visit, user);
    }

    this.transitionPolicy.assertTransitionAllowed(visit.status, status);

    const previousStatus = visit.status;
    const completedAt =
      status === VisitStatus.COMPLETED || status === VisitStatus.CANCELLED ? new Date() : undefined;
    const result = await this.repo.updateStatus(id, status, completedAt);

    // Record tamper-evident audit log for the status transition
    await this.auditLogger.record({
      entity: 'Visit',
      entityId: id,
      action: 'UPDATE',
      actorId: user?.sub ?? null,
      before: { status: previousStatus },
      after: { status, completedAt: completedAt ?? null },
      metadata: { field: 'status', from: previousStatus, to: status },
    });

    return result;
  }
}
