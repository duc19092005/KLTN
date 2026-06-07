import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/prisma/prisma.service';
import {
  RECEPTION_SHIFT_REPOSITORY,
  ReceptionShiftRepositoryPort,
} from '../ports/reception-shift.repository.port';
import { NotificationService } from '../../../notification/services/notification.service';
import { AuditLoggerService } from '../../../../infrastructure/audit/audit-logger.service';

/**
 * Rejects a PENDING reception shift with an optional reason. Same authorization rules as approval.
 */
@Injectable()
export class RejectReceptionShiftUseCase {
  constructor(
    @Inject(RECEPTION_SHIFT_REPOSITORY) private readonly repo: ReceptionShiftRepositoryPort,
    private readonly prisma: PrismaService,
    private readonly notificationService: NotificationService,
    private readonly auditLogger: AuditLoggerService,
  ) {}

  async execute(shiftId: string, actorUserId: string, actorRole: string, reason?: string) {
    const shift = await this.repo.findById(shiftId);
    if (!shift) throw new NotFoundException('Không tìm thấy ca trực.');
    if (shift.status !== 'PENDING') {
      throw new BadRequestException('Chỉ từ chối được ca có trạng thái CHỜ DUYỆT.');
    }

    if (actorRole !== 'ADMIN') {
      const department = await this.prisma.department.findUnique({
        where: { id: shift.departmentId },
        include: { manager: { include: { user: true } } },
      });
      if (!department?.manager || department.manager.user.id !== actorUserId) {
        throw new ForbiddenException('Bạn không có quyền từ chối ca trực này.');
      }
    }

    const trimmedReason = reason?.trim() || null;
    const rejected = await this.repo.updateStatus(shiftId, 'REJECTED', actorUserId, trimmedReason);

    // Detailed tamper-evident audit entry (reception shifts are HR data → off-chain only).
    try {
      await this.auditLogger.record({
        entity: 'ReceptionShift',
        entityId: shiftId,
        action: 'SHIFT_REJECTED',
        actorId: actorUserId,
        after: { status: 'REJECTED', rejectionReason: trimmedReason },
        onChainStatus: 'OFF_CHAIN',
        metadata: {
          staffName: shift.staff?.fullName,
          department: shift.department?.name,
          reason: trimmedReason,
          rejectedByRole: actorRole,
        },
      });
    } catch (err) {
      await this.repo.updateStatus(shiftId, 'PENDING', null, null).catch(() => undefined);
      throw new BadRequestException('Từ chối ca trực thất bại khi ghi nhật ký kiểm toán. Vui lòng thử lại.');
    }

    const dateStr = new Date(shift.startTime).toLocaleDateString('vi-VN');
    const timeStr = `${new Date(shift.startTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} - ${new Date(shift.endTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`;
    const msg = `Ca trực của bạn vào ngày ${dateStr} (${timeStr}) tại phòng ${shift.department.name} đã bị từ chối.${trimmedReason ? ` Lý do: ${trimmedReason}` : ''}`;

    await this.notificationService.createNotification(
      shift.staff.userId,
      'Ca trực bị từ chối',
      msg,
    );

    return rejected;
  }
}
