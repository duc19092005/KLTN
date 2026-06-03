import { Inject, Injectable, BadRequestException, ForbiddenException } from '@nestjs/common';
import {
  PARACLINICAL_SHIFT_REPOSITORY,
  ParaclinicalShiftRepositoryPort,
} from '../ports/paraclinical-shift.repository.port';
import { SECURITY_EVENT_LOGGER, SecurityEventLoggerPort } from '../../../auth/application/ports/security-event-logger.port';

/**
 * Register a shift for the current staff member.
 * Creates a PENDING shift — no blockchain anchoring at this stage.
 *
 * Business rule: Technicians (LAB_MANAGER) work in technical/paraclinical rooms.
 * Doctors work in clinical rooms via the Visit workflow, not shifts.
 */
@Injectable()
export class RegisterShiftUseCase {
  constructor(
    @Inject(PARACLINICAL_SHIFT_REPOSITORY) private readonly repo: ParaclinicalShiftRepositoryPort,
    @Inject(SECURITY_EVENT_LOGGER) private readonly logger: SecurityEventLoggerPort,
  ) {}

  async execute(staffId: string, clinicalRoomId: string, startTime: Date, endTime: Date, actorId: string) {
    // Validate time range
    if (startTime >= endTime) {
      throw new BadRequestException('Thời gian bắt đầu phải trước thời gian kết thúc.');
    }
    if (startTime < new Date()) {
      throw new BadRequestException('Không thể đăng ký ca trực trong quá khứ.');
    }

    const shift = await this.repo.createShift({ staffId, clinicalRoomId, startTime, endTime });

    // Audit log only — no blockchain for PENDING shifts
    await this.logger.write(actorId, 'SHIFT_REGISTERED', 'ParaclinicalShift', shift.id, {
      staffId,
      clinicalRoomId,
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      status: 'PENDING',
    });

    return shift;
  }
}
