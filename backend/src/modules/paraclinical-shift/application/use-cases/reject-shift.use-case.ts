import { Inject, Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import {
  PARACLINICAL_SHIFT_REPOSITORY,
  ParaclinicalShiftRepositoryPort,
} from '../ports/paraclinical-shift.repository.port';
import { SECURITY_EVENT_LOGGER, SecurityEventLoggerPort } from '../../../auth/application/ports/security-event-logger.port';

/**
 * Reject a PENDING shift. No blockchain anchoring needed.
 */
@Injectable()
export class RejectShiftUseCase {
  constructor(
    @Inject(PARACLINICAL_SHIFT_REPOSITORY) private readonly repo: ParaclinicalShiftRepositoryPort,
    @Inject(SECURITY_EVENT_LOGGER) private readonly logger: SecurityEventLoggerPort,
  ) {}

  async execute(shiftId: string, rejectedById: string) {
    const shift = await this.repo.findShiftById(shiftId);
    if (!shift) throw new NotFoundException('Ca trực không tồn tại.');
    if (shift.status !== 'PENDING') {
      throw new BadRequestException('Chỉ có thể từ chối ca trực đang ở trạng thái chờ duyệt.');
    }

    const rejected = await this.repo.rejectShift(shiftId, rejectedById);

    await this.logger.write(rejectedById, 'SHIFT_REJECTED', 'ParaclinicalShift', shiftId, {
      staffName: shift.staff.fullName,
      room: shift.clinicalRoom.roomName,
    });

    return rejected;
  }
}
