import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/prisma/prisma.service';
import {
  RECEPTION_SHIFT_REPOSITORY,
  ReceptionShiftRepositoryPort,
} from '../ports/reception-shift.repository.port';
import { NotificationService } from '../../../notification/services/notification.service';
import { AuditLoggerService } from '../../../../infrastructure/audit/audit-logger.service';

/**
 * Approves a PENDING reception shift.
 *
 * Authorization: ADMIN can approve any shift; otherwise the actor must be the
 * StaffProfile.manager of the shift's department (i.e. trưởng phòng lễ tân).
 */
@Injectable()
export class ApproveReceptionShiftUseCase {
  constructor(
    @Inject(RECEPTION_SHIFT_REPOSITORY) private readonly repo: ReceptionShiftRepositoryPort,
    private readonly prisma: PrismaService,
    private readonly notificationService: NotificationService,
    private readonly auditLogger: AuditLoggerService,
  ) {}

  async execute(shiftId: string, actorUserId: string, actorRole: string) {
    const shift = await this.repo.findById(shiftId);
    if (!shift) throw new NotFoundException('Không tìm thấy ca trực.');
    if (shift.status !== 'PENDING') {
      throw new BadRequestException('Chỉ duyệt được ca có trạng thái CHỜ DUYỆT.');
    }

    await this.assertCanApprove(actorUserId, actorRole, shift.departmentId);

    const approved = await this.repo.updateStatus(shiftId, 'APPROVED', actorUserId, null);

    // Detailed tamper-evident audit entry (reception shifts are HR data → off-chain only).
    try {
      await this.auditLogger.record({
        entity: 'ReceptionShift',
        entityId: shiftId,
        action: 'SHIFT_APPROVED',
        actorId: actorUserId,
        after: { status: 'APPROVED' },
        onChainStatus: 'OFF_CHAIN',
        metadata: {
          staffName: shift.staff?.fullName,
          department: shift.department?.name,
          startTime: new Date(shift.startTime).toISOString(),
          endTime: new Date(shift.endTime).toISOString(),
          approvedByRole: actorRole,
        },
      });
    } catch (err) {
      await this.repo.updateStatus(shiftId, 'PENDING', null, null).catch(() => undefined);
      throw new BadRequestException('Duyệt ca trực thất bại khi ghi nhật ký kiểm toán. Vui lòng thử lại.');
    }

    const dateStr = new Date(shift.startTime).toLocaleDateString('vi-VN');
    const timeStr = `${new Date(shift.startTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} - ${new Date(shift.endTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`;
    const msg = `Ca trực của bạn vào ngày ${dateStr} (${timeStr}) tại phòng ${shift.department.name} đã được phê duyệt.`;

    await this.notificationService.createNotification(
      shift.staff.userId,
      'Ca trực đã được duyệt',
      msg,
    );

    return approved;
  }

  private async assertCanApprove(actorUserId: string, actorRole: string, departmentId: string) {
    if (actorRole === 'ADMIN') return;
    // Manager check: the actor's StaffProfile is set as manager of this department.
    const department = await this.prisma.department.findUnique({
      where: { id: departmentId },
      include: { manager: { include: { user: true } } },
    });
    if (!department?.manager || department.manager.user.id !== actorUserId) {
      throw new ForbiddenException('Bạn không có quyền duyệt ca trực này.');
    }
  }
}
