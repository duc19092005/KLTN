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
 * Approve a PENDING shift.
 * On approval:
 * 1. Generate dataSalt + compute hash256 of the canonical shift data
 * 2. Persist hash to the shift record
 * 3. Write to BlockchainLogger with PENDING on-chain status (batch Merkle anchoring)
 */
@Injectable()
export class ApproveShiftUseCase {
  constructor(
    @Inject(PARACLINICAL_SHIFT_REPOSITORY) private readonly repo: ParaclinicalShiftRepositoryPort,
    @Inject(SECURITY_EVENT_LOGGER) private readonly securityLogger: SecurityEventLoggerPort,
    private readonly auditLogger: AuditLoggerService,
    private readonly notificationService: NotificationService,
    private readonly prisma: PrismaService,
  ) {}

  async execute(shiftId: string, approvedById: string, actorRole?: string) {
    const shift = await this.repo.findShiftById(shiftId);
    if (!shift) throw new NotFoundException('Ca trực không tồn tại.');
    if (shift.status !== 'PENDING') {
      throw new BadRequestException('Chỉ có thể duyệt ca trực đang ở trạng thái chờ duyệt.');
    }

    let role = actorRole;
    if (!role) {
      const user = await this.prisma.user.findUnique({ where: { id: approvedById } });
      role = user?.role;
    }

    await this.assertCanApprove(approvedById, role || 'STAFF', shift.staff.department?.id);

    // Check for overlapping approved shifts in the same room
    const hasOverlap = await this.repo.hasOverlappingShift(
      shift.clinicalRoomId,
      shift.startTime,
      shift.endTime,
    );
    if (hasOverlap) {
      throw new BadRequestException('Ca trực trùng lặp với ca trực đã duyệt khác trong cùng phòng.');
    }

    // Compute tamper-evidence hash
    const snapshot = {
      staffId: shift.staffId,
      clinicalRoomId: shift.clinicalRoomId,
      startTime: shift.startTime.toISOString(),
      endTime: shift.endTime.toISOString(),
      status: 'APPROVED',
    };
    const { salt, hash } = this.auditLogger.hashSnapshot(snapshot);

    // Update shift with APPROVED status + hash
    const approved = await this.repo.approveShift(shiftId, approvedById, hash, salt);

    // Write to BlockchainLogger (PENDING on-chain → batch Merkle anchoring).
    // If anchoring fails, compensate by reverting the shift back to PENDING so an
    // approved shift never exists without its integrity anchor.
    try {
      await this.auditLogger.record({
        entity: 'ParaclinicalShift',
        entityId: shiftId,
        action: 'SHIFT_APPROVED',
        actorId: approvedById,
        dataHash: hash,
        dataSalt: salt,
        after: snapshot,
        onChainStatus: 'PENDING',
        metadata: {
          staffName: shift.staff.fullName,
          room: shift.clinicalRoom.roomName,
          startTime: shift.startTime.toISOString(),
          endTime: shift.endTime.toISOString(),
          // Detailed audit trail: who approved (role) and for which department. ADMIN approves
          // anything; a department head only their own department (see assertCanApprove).
          approvedByRole: role,
          departmentId: shift.staff.department?.id ?? null,
        },
      });
    } catch (err) {
      await this.repo.revertToPending(shiftId).catch(() => undefined);
      throw new BadRequestException('Duyệt ca trực thất bại khi neo dữ liệu lên blockchain. Vui lòng thử lại.');
    }

    const dateStr = new Date(shift.startTime).toLocaleDateString('vi-VN');
    const timeStr = `${new Date(shift.startTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} - ${new Date(shift.endTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`;
    const msg = `Ca trực của bạn vào ngày ${dateStr} (${timeStr}) tại phòng ${shift.clinicalRoom.roomName} đã được phê duyệt.`;

    await this.notificationService.createNotification(
      shift.staff.user.id,
      'Ca trực đã được duyệt',
      msg,
    );

    return approved;
  }

  private async assertCanApprove(actorUserId: string, actorRole: string, departmentId?: string) {
    if (actorRole === 'ADMIN') return;
    if (!departmentId) {
      throw new ForbiddenException('Bạn không có quyền duyệt ca trực này.');
    }
    const department = await this.prisma.department.findUnique({
      where: { id: departmentId },
      include: { manager: { include: { user: true } } },
    });
    if (!department?.manager || department.manager.user.id !== actorUserId) {
      throw new ForbiddenException('Bạn không có quyền duyệt ca trực này.');
    }
  }
}
