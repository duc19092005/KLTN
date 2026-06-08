import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import {
  PARACLINICAL_SHIFT_REPOSITORY,
  ParaclinicalShiftRepositoryPort,
} from '../ports/paraclinical-shift.repository.port';
import { AuditLoggerService } from '../../../../infrastructure/audit/audit-logger.service';

/**
 * Admin/Head-of-department directly assigns a shift (auto-APPROVED).
 */
@Injectable()
export class AssignShiftUseCase {
  constructor(
    @Inject(PARACLINICAL_SHIFT_REPOSITORY) private readonly repo: ParaclinicalShiftRepositoryPort,
    private readonly auditLogger: AuditLoggerService,
  ) {}

  async execute(staffId: string, departmentId: string, startTime: Date, endTime: Date, approvedById: string) {
    if (startTime >= endTime) {
      throw new BadRequestException('Thời gian bắt đầu phải trước thời gian kết thúc.');
    }

    const hasOverlap = await this.repo.hasOverlappingShift(departmentId, startTime, endTime);
    if (hasOverlap) {
      throw new BadRequestException('Ca trực trùng lặp với ca trực đã duyệt khác trong cùng phòng ban.');
    }

    const snapshot = {
      staffId,
      departmentId,
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      status: 'APPROVED',
    };
    const { salt, hash } = this.auditLogger.hashSnapshot(snapshot);

    const shift = await this.repo.assignShift({ staffId, departmentId, startTime, endTime, approvedById });
    await this.repo.approveShift(shift.id, approvedById, hash, salt);

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
        department: shift.department.name,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        directAssignment: true,
      },
    });

    return shift;
  }
}
