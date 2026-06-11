import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { ShiftCode } from '@prisma/client';
import {
  PARACLINICAL_SHIFT_REPOSITORY,
  ParaclinicalShiftRepositoryPort,
} from '../ports/paraclinical-shift.repository.port';
import { AuditLoggerService } from '../../../../infrastructure/audit/audit-logger.service';
import { resolveParaclinicalShiftWindow } from '../utils/shift-schedule.util';

/**
 * Admin/Head-of-department directly assigns a shift (auto-APPROVED).
 */
@Injectable()
export class AssignShiftUseCase {
  constructor(
    @Inject(PARACLINICAL_SHIFT_REPOSITORY) private readonly repo: ParaclinicalShiftRepositoryPort,
    private readonly auditLogger: AuditLoggerService,
  ) {}

  async execute(staffId: string, departmentId: string, workDateInput: Date, shiftCode: ShiftCode, approvedById: string) {
    const schedule = resolveParaclinicalShiftWindow(workDateInput, shiftCode);

    const duplicated = await this.repo.hasStaffShiftOnDateCode(staffId, schedule.workDate, schedule.shiftCode);
    if (duplicated) {
      throw new BadRequestException('Nhân viên đã có lịch trực hoặc đăng ký cho ca này trong ngày.');
    }

    const snapshot = {
      staffId,
      departmentId,
      workDate: schedule.workDate.toISOString(),
      shiftCode: schedule.shiftCode,
      startTime: schedule.startTime.toISOString(),
      endTime: schedule.endTime.toISOString(),
      status: 'APPROVED',
    };
    const { salt, hash } = this.auditLogger.hashSnapshot(snapshot);

    const shift = await this.repo.assignShift({
      staffId,
      departmentId,
      workDate: schedule.workDate,
      shiftCode: schedule.shiftCode,
      startTime: schedule.startTime,
      endTime: schedule.endTime,
      approvedById,
    });
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
        workDate: schedule.workDate.toISOString(),
        shiftCode: schedule.shiftCode,
        shiftLabel: schedule.label,
        startTime: schedule.startTime.toISOString(),
        endTime: schedule.endTime.toISOString(),
        directAssignment: true,
      },
    });

    return shift;
  }
}
