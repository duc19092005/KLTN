import { BadRequestException, Injectable } from '@nestjs/common';
import { UserRole, VisitStatus } from '@prisma/client';
import { AuthUser } from '../../../../common/types/auth-user.type';
import { VisitEntity } from '../ports/visit.repository.port';

// Allowed VisitStatus transitions for the direct PATCH /visits/:id/status endpoint.
// Note: automated transitions made by medical-order/clinical-decision services use
// tx.visit.update directly and are intentionally not constrained here.
const ALLOWED_VISIT_TRANSITIONS: Record<VisitStatus, VisitStatus[]> = {
  [VisitStatus.WAITING]: [VisitStatus.IN_PROGRESS, VisitStatus.CANCELLED],
  [VisitStatus.IN_PROGRESS]: [VisitStatus.WAITING_TEST_RESULT, VisitStatus.WAITING_CONCLUSION, VisitStatus.CANCELLED],
  [VisitStatus.WAITING_TEST_RESULT]: [VisitStatus.IN_PROGRESS, VisitStatus.WAITING_CONCLUSION],
  [VisitStatus.WAITING_CONCLUSION]: [VisitStatus.IN_PROGRESS, VisitStatus.COMPLETED],
  [VisitStatus.COMPLETED]: [],
  [VisitStatus.CANCELLED]: [],
};

/**
 * Pure business rules for Visit status changes via the direct status endpoint.
 * Extracted verbatim from VisitService so it can be unit-tested in isolation.
 */
@Injectable()
export class VisitTransitionPolicy {
  /** Role-scoped guard for cancelling a visit. */
  ensureCanCancel(visit: VisitEntity, user?: AuthUser): void {
    if (!user || user.role === UserRole.ADMIN) return;
    if (user.role === UserRole.RECEPTIONIST && visit.status !== VisitStatus.WAITING) {
      throw new BadRequestException('Receptionist can only cancel visits before examination starts');
    }
    if (
      user.role === UserRole.DOCTOR &&
      !([VisitStatus.WAITING, VisitStatus.IN_PROGRESS] as VisitStatus[]).includes(visit.status)
    ) {
      throw new BadRequestException('Doctor can only cancel visits before test orders/results are created');
    }
  }

  /**
   * Validates a requested transition. Terminal states reject; same-status calls are
   * idempotent no-ops; any other unlisted jump (e.g. WAITING -> COMPLETED) is rejected.
   */
  assertTransitionAllowed(current: VisitStatus, next: VisitStatus): void {
    if (current === VisitStatus.COMPLETED || current === VisitStatus.CANCELLED) {
      throw new BadRequestException('Cannot update a completed/cancelled visit');
    }
    if (next !== current && !ALLOWED_VISIT_TRANSITIONS[current].includes(next)) {
      throw new BadRequestException(`Không thể chuyển trạng thái lượt khám từ ${current} sang ${next}`);
    }
  }
}
