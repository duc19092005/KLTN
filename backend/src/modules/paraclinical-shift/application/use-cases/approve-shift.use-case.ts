import { Inject, Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import {
  PARACLINICAL_SHIFT_REPOSITORY,
  ParaclinicalShiftRepositoryPort,
} from '../ports/paraclinical-shift.repository.port';
import { SECURITY_EVENT_LOGGER, SecurityEventLoggerPort } from '../../../auth/application/ports/security-event-logger.port';
import { AuditLoggerService } from '../../../../infrastructure/audit/audit-logger.service';

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
  ) {}

  async execute(shiftId: string, approvedById: string) {
    const shift = await this.repo.findShiftById(shiftId);
    if (!shift) throw new NotFoundException('Ca trực không tồn tại.');
    if (shift.status !== 'PENDING') {
      throw new BadRequestException('Chỉ có thể duyệt ca trực đang ở trạng thái chờ duyệt.');
    }

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

    // Write to BlockchainLogger (PENDING on-chain → batch Merkle anchoring)
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
      },
    });

    return approved;
  }
}
