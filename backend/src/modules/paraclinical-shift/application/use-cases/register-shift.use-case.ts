import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import {
  PARACLINICAL_SHIFT_REPOSITORY,
  ParaclinicalShiftRepositoryPort,
} from '../ports/paraclinical-shift.repository.port';
import { AuditLoggerService } from '../../../../infrastructure/audit/audit-logger.service';
import { PrismaService } from '../../../../infrastructure/prisma/prisma.service';
import { resolveParaclinicalShiftWindow } from '../utils/shift-schedule.util';

/**
 * Register a paraclinical shift against a laboratory/imaging department.
 */
@Injectable()
export class RegisterShiftUseCase {
  constructor(
    @Inject(PARACLINICAL_SHIFT_REPOSITORY) private readonly repo: ParaclinicalShiftRepositoryPort,
    private readonly auditLogger: AuditLoggerService,
    private readonly prisma: PrismaService,
  ) {}

  async execute(
    staffId: string,
    departmentId: string,
    workDateInput: Date,
    shiftCode: import('@prisma/client').ShiftCode,
    actorId: string,
    note?: string,
    demoMode = false,
  ) {
    const schedule = resolveParaclinicalShiftWindow(workDateInput, shiftCode);
    const minRegistrationDate = new Date();
    minRegistrationDate.setHours(0, 0, 0, 0);
    minRegistrationDate.setDate(minRegistrationDate.getDate() + 7);

    if (!demoMode && schedule.workDate < minRegistrationDate) {
      throw new BadRequestException('Lịch trực phải được đăng ký trước ít nhất 1 tuần.');
    }

    const trimmedNote = note?.trim() || null;
    await this.assertStaffCanWorkInDepartment(staffId, departmentId);

    const duplicated = await this.repo.hasStaffShiftOnDateCode(staffId, schedule.workDate, schedule.shiftCode);
    if (duplicated) {
      throw new BadRequestException('Nhân viên đã có đăng ký hoặc lịch trực cho ca này trong ngày.');
    }

    const shift = await this.repo.createShift({
      staffId,
      departmentId,
      workDate: schedule.workDate,
      shiftCode: schedule.shiftCode,
      startTime: schedule.startTime,
      endTime: schedule.endTime,
      note: trimmedNote,
    });

    const finalStatus = demoMode ? 'APPROVED' : 'PENDING';
    const snapshot = {
      staffId,
      departmentId,
      workDate: schedule.workDate.toISOString(),
      shiftCode: schedule.shiftCode,
      startTime: schedule.startTime.toISOString(),
      endTime: schedule.endTime.toISOString(),
      status: finalStatus,
    };
    const { salt, hash } = this.auditLogger.hashSnapshot(snapshot);

    try {
      const persistedShift = demoMode
        ? await this.repo.approveShift(shift.id, actorId, hash, salt)
        : await this.repo.setShiftHash(shift.id, hash, salt);

      await this.auditLogger.record({
        entity: 'ParaclinicalShift',
        entityId: shift.id,
        action: demoMode ? 'SHIFT_REGISTERED_AUTO_APPROVED' : 'SHIFT_REGISTERED',
        actorId,
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
          hasNote: Boolean(trimmedNote),
          demoMode,
        },
      });

      return { ...persistedShift, hash256: hash, dataSalt: salt };
    } catch {
      await this.repo.hardDeleteShift(shift.id).catch(() => undefined);
      throw new BadRequestException('Đăng ký ca trực thất bại khi neo dữ liệu lên blockchain. Vui lòng thử lại.');
    }
  }

  async resolveDepartment(departmentId: string): Promise<string> {
    const department = await this.prisma.department.findUnique({
      where: { id: departmentId },
      select: { id: true, type: true, canReceiveOrders: true },
    });
    if (!department || !department.canReceiveOrders || (department.type !== 'LABORATORY' && department.type !== 'IMAGING')) {
      throw new BadRequestException('Phòng ban không hợp lệ cho ca trực cận lâm sàng.');
    }
    return department.id;
  }

  async resolveStaffId(userIdOrStaffId: string): Promise<string | null> {
    const staff = await this.prisma.staffProfile.findUnique({
      where: { id: userIdOrStaffId },
      select: { id: true },
    });
    if (staff) return staff.id;

    const staffByUser = await this.prisma.staffProfile.findUnique({
      where: { userId: userIdOrStaffId },
      select: { id: true },
    });
    return staffByUser?.id ?? null;
  }

  private async assertStaffCanWorkInDepartment(staffId: string, departmentId: string) {
    const [staff, department] = await Promise.all([
      this.prisma.staffProfile.findUnique({
        where: { id: staffId },
        select: { labSpecialty: true, user: { select: { role: true } } },
      }),
      this.prisma.department.findUnique({
        where: { id: departmentId },
        select: { id: true, type: true, name: true, status: true, canReceiveOrders: true },
      }),
    ]);

    if (!staff || staff.user.role !== 'LAB_MANAGER') {
      throw new BadRequestException('Chỉ nhân viên cận lâm sàng mới được đăng ký ca trực.');
    }
    if (!department || department.status !== 'ACTIVE' || !department.canReceiveOrders || (department.type !== 'LABORATORY' && department.type !== 'IMAGING')) {
      throw new BadRequestException('Chỉ được đăng ký ca tại khoa xét nghiệm hoặc chẩn đoán hình ảnh đang hoạt động và có nhận chỉ định.');
    }

    const specialty = staff.labSpecialty;
    const canWork = !specialty || specialty === 'BOTH' || specialty === department.type;
    if (!canWork) {
      throw new BadRequestException(`Chuyên môn của nhân viên không phù hợp với phòng ban ${department.name}.`);
    }
  }
}
