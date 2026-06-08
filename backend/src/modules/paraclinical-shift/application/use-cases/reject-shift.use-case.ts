import { ForbiddenException, Inject, Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import {
  PARACLINICAL_SHIFT_REPOSITORY,
  ParaclinicalShiftRepositoryPort,
} from '../ports/paraclinical-shift.repository.port';
import { SECURITY_EVENT_LOGGER, SecurityEventLoggerPort } from '../../../auth/application/ports/security-event-logger.port';
import { AuditLoggerService } from '../../../../infrastructure/audit/audit-logger.service';
import { NotificationService } from '../../../notification/services/notification.service';
import { PrismaService } from '../../../../infrastructure/prisma/prisma.service';

/**
 * Reject a PENDING shift. The status change is recorded in the tamper-evident audit log
 * (no on-chain integrity hash is needed for a rejected shift).
 */
@Injectable()
export class RejectShiftUseCase {
  constructor(
    @Inject(PARACLINICAL_SHIFT_REPOSITORY) private readonly repo: ParaclinicalShiftRepositoryPort,
    @Inject(SECURITY_EVENT_LOGGER) private readonly logger: SecurityEventLoggerPort,
    private readonly auditLogger: AuditLoggerService,
    private readonly notificationService: NotificationService,
    private readonly prisma: PrismaService,
  ) {}

  async execute(shiftId: string, rejectedById: string, actorRole?: string, reason?: string) {
    const shift = await this.repo.findShiftById(shiftId);
    if (!shift) throw new NotFoundException('Ca trực không tồn tại.');
    if (shift.status !== 'PENDING') {
      throw new BadRequestException('Chỉ có thể từ chối ca trực đang ở trạng thái chờ duyệt.');
    }

    let role = actorRole;
    if (!role) {
      const user = await this.prisma.user.findUnique({ where: { id: rejectedById } });
      role = user?.role;
    }

    await this.assertCanReject(rejectedById, role || 'STAFF', shift.staff.department?.id);

    const trimmedReason = reason?.trim() || null;
    const rejected = await this.repo.rejectShift(shiftId, rejectedById, trimmedReason);

    // Detailed tamper-evident audit entry. If it fails, compensate by reverting to PENDING.
    try {
      await this.auditLogger.record({
        entity: 'ParaclinicalShift',
        entityId: shiftId,
        action: 'SHIFT_REJECTED',
        actorId: rejectedById,
        after: { status: 'REJECTED', rejectionReason: trimmedReason },
        onChainStatus: 'OFF_CHAIN',
        metadata: {
          staffName: shift.staff.fullName,
          department: shift.department.name,
          reason: trimmedReason,
          rejectedByRole: role,
        },
      });
    } catch (err) {
      await this.repo.revertToPending(shiftId).catch(() => undefined);
      throw new BadRequestException('Từ chối ca trực thất bại khi ghi nhật ký kiểm toán. Vui lòng thử lại.');
    }

    const dateStr = new Date(shift.startTime).toLocaleDateString('vi-VN');
    const timeStr = `${new Date(shift.startTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} - ${new Date(shift.endTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`;
    const msg = `Ca trực của bạn vào ngày ${dateStr} (${timeStr}) tại phòng ban ${shift.department.name} đã bị từ chối.${trimmedReason ? ` Lý do: ${trimmedReason}` : ''}`;

    await this.notificationService.createNotification(
      shift.staff.user.id,
      'Ca trực bị từ chối',
      msg,
    );

    return rejected;
  }

  private async assertCanReject(actorUserId: string, actorRole: string, departmentId?: string) {
    if (actorRole === 'ADMIN') return;
    if (!departmentId) {
      throw new ForbiddenException('Bạn không có quyền từ chối ca trực này.');
    }
    const department = await this.prisma.department.findUnique({
      where: { id: departmentId },
      include: { manager: { include: { user: true } } },
    });
    if (!department?.manager || department.manager.user.id !== actorUserId) {
      throw new ForbiddenException('Bạn không có quyền từ chối ca trực này.');
    }
  }
}
