import { Inject, Injectable, BadRequestException, ForbiddenException } from '@nestjs/common';
import {
  PARACLINICAL_SHIFT_REPOSITORY,
  ParaclinicalShiftRepositoryPort,
} from '../ports/paraclinical-shift.repository.port';
import { SECURITY_EVENT_LOGGER, SecurityEventLoggerPort } from '../../../auth/application/ports/security-event-logger.port';
import { BlockchainParaclinicalShiftIntegrityAnchor } from '../../infrastructure/adapters/blockchain-paraclinical-shift-integrity.anchor';

/**
 * Initiate a handover: the current shift-holder (A) declares they want to
 * transfer responsibility to staff member B. Creates an incomplete HandoverLog.
 */
@Injectable()
export class InitiateHandoverUseCase {
  constructor(
    @Inject(PARACLINICAL_SHIFT_REPOSITORY) private readonly repo: ParaclinicalShiftRepositoryPort,
    @Inject(SECURITY_EVENT_LOGGER) private readonly logger: SecurityEventLoggerPort,
    private readonly shiftIntegrity: BlockchainParaclinicalShiftIntegrityAnchor,
  ) {}

  async execute(fromStaffId: string, toStaffId: string, clinicalRoomId: string, reason?: string) {
    if (fromStaffId === toStaffId) {
      throw new BadRequestException('Người bàn giao và người nhận ca không thể là cùng một người.');
    }

    // Verify the "from" staff actually has an active shift in this room
    const now = new Date();
    const activeShift = await this.repo.findActiveShiftForRoom(clinicalRoomId, now);
    if (!activeShift || activeShift.staffId !== fromStaffId) {
      throw new ForbiddenException('Bạn không phải là nhân viên đang phụ trách ca trực tại phòng này.');
    }

    // Verify active shift integrity
    const integrity = await this.shiftIntegrity.evaluate(activeShift);
    if (integrity.status === 'TAMPERED') {
      throw new ForbiddenException(
        'Phát hiện dữ liệu ca trực bị sửa đổi trái phép (Tampered). Vui lòng liên hệ Quản trị viên.',
      );
    }

    const handover = await this.repo.createHandoverLog({
      clinicalRoomId,
      fromStaffId,
      toStaffId,
      reason,
    });

    await this.logger.write(fromStaffId, 'HANDOVER_INITIATED', 'HandoverLog', handover.id, {
      fromStaff: handover.fromStaff.fullName,
      toStaff: handover.toStaff.fullName,
      clinicalRoomId,
    });

    return handover;
  }
}
