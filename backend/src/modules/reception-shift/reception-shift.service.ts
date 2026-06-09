import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ShiftCode, UserRole } from '@prisma/client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { NotificationService } from '../notification/services/notification.service';
import { resolveParaclinicalShiftWindow } from '../paraclinical-shift/application/utils/shift-schedule.util';

@Injectable()
export class ReceptionShiftService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationService: NotificationService,
  ) {}

  async availableDepartments() {
    const departments = await this.prisma.department.findMany({
      where: { status: 'ACTIVE', type: 'ADMINISTRATIVE' },
      orderBy: [{ name: 'asc' }],
      select: { id: true, departmentCode: true, name: true, type: true, floor: true },
    });

    return departments.map((department) => ({
      ...department,
      roomName: `[HC] ${department.name}`,
      roomCode: department.departmentCode,
    }));
  }

  async register(userId: string, departmentId: string, workDate: Date, shiftCode: ShiftCode, note?: string, demoMode = false) {
    const staff = await this.resolveReceptionistStaff(userId);
    await this.assertAdministrativeDepartment(departmentId);
    const schedule = resolveParaclinicalShiftWindow(workDate, shiftCode);

    if (!demoMode && schedule.endTime < new Date()) {
      throw new BadRequestException('Không thể đăng ký ca làm trong quá khứ.');
    }

    await this.assertNoDuplicate(staff.id, schedule.workDate, schedule.shiftCode);

    return this.prisma.staffShift.create({
      data: {
        staffId: staff.id,
        departmentId,
        workDate: schedule.workDate,
        shiftCode: schedule.shiftCode,
        startTime: schedule.startTime,
        endTime: schedule.endTime,
        note: note?.trim() || null,
        status: demoMode ? 'APPROVED' : 'PENDING',
        shiftType: 'RECEPTION',
        approvedById: demoMode ? userId : null,
      },
      include: RECEPTION_SHIFT_INCLUDE,
    });
  }

  async registerMany(
    userId: string,
    items: Array<{ departmentId: string; workDate: string; shiftCode: ShiftCode; note?: string }>,
    demoMode = false,
  ) {
    const staff = await this.resolveReceptionistStaff(userId);
    const now = new Date();
    const seen = new Set<string>();
    const prepared = [];

    for (const item of items) {
      await this.assertAdministrativeDepartment(item.departmentId);
      const schedule = resolveParaclinicalShiftWindow(new Date(item.workDate), item.shiftCode);
      const key = `${schedule.workDate.toISOString()}:${schedule.shiftCode}`;
      if (seen.has(key)) {
        throw new BadRequestException('Danh sách gửi có ca bị chọn trùng.');
      }
      seen.add(key);
      if (!demoMode && schedule.endTime < now) {
        throw new BadRequestException('Không thể đăng ký ca làm trong quá khứ.');
      }
      await this.assertNoDuplicate(staff.id, schedule.workDate, schedule.shiftCode);
      prepared.push({ item, schedule });
    }

    return this.prisma.$transaction(
      prepared.map(({ item, schedule }) => this.prisma.staffShift.create({
        data: {
          staffId: staff.id,
          departmentId: item.departmentId,
          workDate: schedule.workDate,
          shiftCode: schedule.shiftCode,
          startTime: schedule.startTime,
          endTime: schedule.endTime,
          note: item.note?.trim() || null,
          status: demoMode ? 'APPROVED' : 'PENDING',
          shiftType: 'RECEPTION',
          approvedById: demoMode ? userId : null,
        },
        include: RECEPTION_SHIFT_INCLUDE,
      })),
    );
  }

  async assign(actorUserId: string, actorRole: string, staffId: string, departmentId: string, workDate: Date, shiftCode: ShiftCode) {
    await this.assertCanManage(actorUserId, actorRole, departmentId);
    const staff = await this.prisma.staffProfile.findUnique({ where: { id: staffId }, include: { user: true } });
    if (!staff || staff.user.role !== UserRole.RECEPTIONIST) {
      throw new BadRequestException('Chỉ có thể xếp ca cho nhân viên lễ tân.');
    }
    await this.assertAdministrativeDepartment(departmentId);
    const schedule = resolveParaclinicalShiftWindow(workDate, shiftCode);
    await this.assertNoDuplicate(staffId, schedule.workDate, schedule.shiftCode);

    return this.prisma.staffShift.create({
      data: {
        staffId,
        departmentId,
        workDate: schedule.workDate,
        shiftCode: schedule.shiftCode,
        startTime: schedule.startTime,
        endTime: schedule.endTime,
        status: 'APPROVED',
        shiftType: 'RECEPTION',
        approvedById: actorUserId,
      },
      include: RECEPTION_SHIFT_INCLUDE,
    });
  }

  async approve(actorUserId: string, actorRole: string, shiftId: string) {
    const shift = await this.findShiftOrThrow(shiftId);
    if (shift.status !== 'PENDING') {
      throw new BadRequestException('Chỉ có thể duyệt ca đang chờ duyệt.');
    }
    await this.assertCanManage(actorUserId, actorRole, shift.departmentId);

    const approved = await this.prisma.staffShift.update({
      where: { id: shiftId },
      data: { status: 'APPROVED', approvedById: actorUserId },
      include: RECEPTION_SHIFT_INCLUDE,
    });

    await this.notificationService.createNotification(
      shift.staff.user.id,
      'Ca làm việc lễ tân đã được duyệt',
      `Ca ${shift.shiftCode} ngày ${shift.workDate.toLocaleDateString('vi-VN')} tại ${shift.department.name} đã được phê duyệt.`,
    );

    return approved;
  }

  async reject(actorUserId: string, actorRole: string, shiftId: string, reason?: string) {
    const shift = await this.findShiftOrThrow(shiftId);
    if (shift.status !== 'PENDING') {
      throw new BadRequestException('Chỉ có thể từ chối ca đang chờ duyệt.');
    }
    await this.assertCanManage(actorUserId, actorRole, shift.departmentId);

    const rejected = await this.prisma.staffShift.update({
      where: { id: shiftId },
      data: { status: 'REJECTED', approvedById: actorUserId, rejectionReason: reason?.trim() || null, isActive: false },
      include: RECEPTION_SHIFT_INCLUDE,
    });

    await this.notificationService.createNotification(
      shift.staff.user.id,
      'Ca làm việc lễ tân bị từ chối',
      `Ca ${shift.shiftCode} ngày ${shift.workDate.toLocaleDateString('vi-VN')} tại ${shift.department.name} đã bị từ chối.`,
    );

    return rejected;
  }

  async myShifts(userId: string, from?: Date, to?: Date) {
    const staff = await this.resolveReceptionistStaff(userId);
    return this.prisma.staffShift.findMany({
      where: {
        shiftType: 'RECEPTION',
        staffId: staff.id,
        ...(from || to ? { startTime: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}),
      },
      include: RECEPTION_SHIFT_INCLUDE,
      orderBy: { startTime: 'desc' },
    });
  }

  async pending(actorUserId: string, actorRole: string, departmentId?: string) {
    const scopedDepartmentId = await this.resolveManagedDepartmentScope(actorUserId, actorRole, departmentId);
    return this.prisma.staffShift.findMany({
      where: { shiftType: 'RECEPTION', status: 'PENDING', isActive: true, ...(scopedDepartmentId ? { departmentId: scopedDepartmentId } : {}) },
      include: RECEPTION_SHIFT_INCLUDE,
      orderBy: { createdAt: 'asc' },
    });
  }

  async listByDepartment(actorUserId: string, actorRole: string, departmentId: string, from?: Date, to?: Date) {
    await this.assertCanManage(actorUserId, actorRole, departmentId);
    return this.prisma.staffShift.findMany({
      where: {
        shiftType: 'RECEPTION',
        departmentId,
        isActive: true,
        ...(from || to ? { startTime: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}),
      },
      include: RECEPTION_SHIFT_INCLUDE,
      orderBy: { startTime: 'desc' },
    });
  }

  private async resolveReceptionistStaff(userId: string) {
    const staff = await this.prisma.staffProfile.findUnique({
      where: { userId },
      include: { user: true },
    });
    if (!staff || staff.user.role !== UserRole.RECEPTIONIST) {
      throw new BadRequestException('Chỉ nhân viên lễ tân mới được đăng ký ca làm.');
    }
    return staff;
  }

  private async assertAdministrativeDepartment(departmentId: string) {
    const department = await this.prisma.department.findUnique({ where: { id: departmentId } });
    if (!department || department.status !== 'ACTIVE' || department.type !== 'ADMINISTRATIVE') {
      throw new BadRequestException('Lễ tân chỉ được đăng ký ca tại phòng ban hành chính đang hoạt động.');
    }
  }

  private async assertNoDuplicate(staffId: string, workDate: Date, shiftCode: ShiftCode) {
    const count = await this.prisma.staffShift.count({
      where: { staffId, workDate, shiftCode, isActive: true, status: { in: ['PENDING', 'APPROVED'] } },
    });
    if (count > 0) {
      throw new BadRequestException('Nhân viên đã có đăng ký hoặc lịch làm cho ca này trong ngày.');
    }
  }

  private async findShiftOrThrow(shiftId: string) {
    const shift = await this.prisma.staffShift.findFirst({ where: { id: shiftId, shiftType: 'RECEPTION' }, include: RECEPTION_SHIFT_INCLUDE });
    if (!shift) throw new NotFoundException('Ca làm việc không tồn tại.');
    return shift;
  }

  private async assertCanManage(actorUserId: string, actorRole: string, departmentId: string) {
    if (actorRole === UserRole.ADMIN) return;
    const department = await this.prisma.department.findUnique({
      where: { id: departmentId },
      include: { manager: { include: { user: true } } },
    });
    if (department?.type !== 'ADMINISTRATIVE' || department.manager?.user.id !== actorUserId) {
      throw new ForbiddenException('Bạn không có quyền quản lý ca làm việc lễ tân này.');
    }
  }

  private async resolveManagedDepartmentScope(actorUserId: string, actorRole: string, departmentId?: string) {
    if (actorRole === UserRole.ADMIN) return departmentId;
    if (departmentId) {
      await this.assertCanManage(actorUserId, actorRole, departmentId);
      return departmentId;
    }
    const managed = await this.prisma.department.findFirst({
      where: { type: 'ADMINISTRATIVE', manager: { userId: actorUserId } },
      select: { id: true },
    });
    if (!managed) throw new ForbiddenException('Bạn không có quyền quản lý ca làm việc lễ tân.');
    return managed.id;
  }
}

const RECEPTION_SHIFT_INCLUDE = {
  staff: {
    include: {
      user: { select: { id: true, username: true, role: true } },
      department: { select: { id: true, departmentCode: true, name: true, type: true } },
    },
  },
  department: { select: { id: true, departmentCode: true, name: true, type: true } },
} as const;
