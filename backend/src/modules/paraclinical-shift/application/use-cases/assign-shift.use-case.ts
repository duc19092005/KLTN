import { Inject, Injectable, BadRequestException } from '@nestjs/common';
import {
  PARACLINICAL_SHIFT_REPOSITORY,
  ParaclinicalShiftRepositoryPort,
} from '../ports/paraclinical-shift.repository.port';
import { SECURITY_EVENT_LOGGER, SecurityEventLoggerPort } from '../../../auth/application/ports/security-event-logger.port';
import { AuditLoggerService } from '../../../../infrastructure/audit/audit-logger.service';

/**
 * Admin/Head-of-department directly assigns a shift (auto-APPROVED).
 * Generates hash + queues for batch Merkle anchoring.
 */
@Injectable()
export class AssignShiftUseCase {
  constructor(
    @Inject(PARACLINICAL_SHIFT_REPOSITORY) private readonly repo: ParaclinicalShiftRepositoryPort,
    @Inject(SECURITY_EVENT_LOGGER) private readonly securityLogger: SecurityEventLoggerPort,
    private readonly auditLogger: AuditLoggerService,
  ) {}

  async execute(
    staffId: string,
    clinicalRoomId: string,
    startTime: Date,
    endTime: Date,
    approvedById: string,
  ) {
    if (startTime >= endTime) {
      throw new BadRequestException('Thời gian bắt đầu phải trước thời gian kết thúc.');
    }

    const hasOverlap = await this.repo.hasOverlappingShift(clinicalRoomId, startTime, endTime);
    if (hasOverlap) {
      throw new BadRequestException('Ca trực trùng lặp với ca trực đã duyệt khác trong cùng phòng.');
    }

    // Compute tamper-evidence hash for the pre-approved shift
    const snapshot = {
      staffId,
      clinicalRoomId,
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      status: 'APPROVED',
    };
    const { salt, hash } = this.auditLogger.hashSnapshot(snapshot);

    const shift = await this.repo.assignShift({
      staffId,
      clinicalRoomId,
      startTime,
      endTime,
      approvedById,
    });

    // Update hash on the created shift
    await this.repo.approveShift(shift.id, approvedById, hash, salt);

    // Write to BlockchainLogger (batch anchoring)
    await this.auditLogger.record({
      entity: 'ParaclinicalShift',
      entityId: shift.id,
      action: 'SHIFT_ASSIGNED',
      actorId: approvedById,
      dataHash: hash,
      dataSalt: salt,
      after: snapshot,
      onChainStatus: 'PENDING',
      metadata: {
        staffName: shift.staff.fullName,
        room: shift.clinicalRoom.roomName,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        directAssignment: true,
      },
    });

    return shift;
  }
}
