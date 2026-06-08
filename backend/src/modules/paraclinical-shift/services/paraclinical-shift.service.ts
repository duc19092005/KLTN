import { Injectable } from '@nestjs/common';
import { RegisterShiftUseCase } from '../application/use-cases/register-shift.use-case';
import { ApproveShiftUseCase } from '../application/use-cases/approve-shift.use-case';
import { RejectShiftUseCase } from '../application/use-cases/reject-shift.use-case';
import { AssignShiftUseCase } from '../application/use-cases/assign-shift.use-case';
import { ListRoomShiftsUseCase } from '../application/use-cases/list-room-shifts.use-case';
import { ListPendingShiftsUseCase } from '../application/use-cases/list-pending-shifts.use-case';
import { InitiateHandoverUseCase } from '../application/use-cases/initiate-handover.use-case';
import { VerifyHandoverFaceAUseCase } from '../application/use-cases/verify-handover-face-a.use-case';
import { VerifyHandoverFaceBUseCase } from '../application/use-cases/verify-handover-face-b.use-case';
import { VerifyParaclinicalShiftUseCase } from '../application/use-cases/verify-paraclinical-shift.use-case';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';

/**
 * Facade preserving the shift API while the storage model points directly to
 * Department.
 */
@Injectable()
export class ParaclinicalShiftService {
  constructor(
    private readonly registerShiftUC: RegisterShiftUseCase,
    private readonly approveShiftUC: ApproveShiftUseCase,
    private readonly rejectShiftUC: RejectShiftUseCase,
    private readonly assignShiftUC: AssignShiftUseCase,
    private readonly listRoomShiftsUC: ListRoomShiftsUseCase,
    private readonly listPendingShiftsUC: ListPendingShiftsUseCase,
    private readonly initiateHandoverUC: InitiateHandoverUseCase,
    private readonly verifyHandoverFaceAUC: VerifyHandoverFaceAUseCase,
    private readonly verifyHandoverFaceBUC: VerifyHandoverFaceBUseCase,
    private readonly verifyShiftUC: VerifyParaclinicalShiftUseCase,
    private readonly prisma: PrismaService,
  ) {}

  async registerShift(staffIdOrUserId: string, departmentId: string, startTime: Date, endTime: Date, actorId: string, note?: string, demoMode = false) {
    const resolvedDepartmentId = await this.registerShiftUC.resolveDepartment(departmentId);
    const staffId = (await this.registerShiftUC.resolveStaffId(staffIdOrUserId)) ?? staffIdOrUserId;
    return this.registerShiftUC.execute(staffId, resolvedDepartmentId, startTime, endTime, actorId, note, demoMode);
  }

  approveShift(shiftId: string, approvedById: string) {
    return this.approveShiftUC.execute(shiftId, approvedById);
  }

  rejectShift(shiftId: string, rejectedById: string) {
    return this.rejectShiftUC.execute(shiftId, rejectedById);
  }

  async assignShift(staffId: string, departmentId: string, startTime: Date, endTime: Date, approvedById: string) {
    const resolvedDepartmentId = await this.registerShiftUC.resolveDepartment(departmentId);
    return this.assignShiftUC.execute(staffId, resolvedDepartmentId, startTime, endTime, approvedById);
  }

  async listRoomShifts(departmentId: string, from?: Date, to?: Date) {
    const resolvedDepartmentId = await this.registerShiftUC.resolveDepartment(departmentId);
    return this.listRoomShiftsUC.execute(resolvedDepartmentId, from, to);
  }

  listPendingShifts(departmentId?: string) {
    return this.listPendingShiftsUC.execute(departmentId);
  }

  initiateHandover(fromStaffId: string, toStaffId: string, departmentId: string, reason?: string) {
    return this.initiateHandoverUC.execute(fromStaffId, toStaffId, departmentId, reason);
  }

  verifyHandoverFaceA(handoverId: string, faceDescriptor: number[]) {
    return this.verifyHandoverFaceAUC.execute(handoverId, faceDescriptor);
  }

  verifyHandoverFaceB(handoverId: string, faceDescriptor: number[]) {
    return this.verifyHandoverFaceBUC.execute(handoverId, faceDescriptor);
  }

  verifyShift(id: string) {
    return this.verifyShiftUC.verifyOne(id);
  }

  async getAvailableRoomsForUser(userId: string) {
    const staff = await this.prisma.staffProfile.findUnique({
      where: { userId },
      select: { labSpecialty: true },
    });
    const specialty = staff?.labSpecialty;
    const allowedTypes = specialty === 'LABORATORY'
      ? ['LABORATORY' as const]
      : specialty === 'IMAGING'
        ? ['IMAGING' as const]
        : ['LABORATORY' as const, 'IMAGING' as const];

    const departments = await this.prisma.department.findMany({
      where: { status: 'ACTIVE', type: { in: allowedTypes }, canReceiveOrders: true },
      orderBy: [{ type: 'asc' }, { name: 'asc' }],
      select: { id: true, departmentCode: true, name: true, type: true, floor: true, specialty: true },
    });

    return departments.map((department) => ({
      id: department.id,
      departmentId: department.id,
      departmentCode: department.departmentCode,
      name: department.name,
      roomCode: department.departmentCode,
      roomName: `[${department.type === 'LABORATORY' ? 'XN' : 'CĐHA'}] ${department.name}`,
      departmentType: department.type,
      specialty: department.specialty,
      floor: department.floor,
    }));
  }

  async getMyShifts(userId: string, from?: Date, to?: Date) {
    const staff = await this.registerShiftUC.resolveStaffId(userId);
    if (!staff) return [];
    return this.prisma.paraclinicalShift.findMany({
      where: {
        staffId: staff,
        ...(from || to
          ? {
              startTime: {
                ...(from ? { gte: from } : {}),
                ...(to ? { lte: to } : {}),
              },
            }
          : {}),
      },
      include: {
        staff: { select: { id: true, fullName: true, userId: true } },
        department: { select: { id: true, departmentCode: true, name: true, type: true } },
      },
      orderBy: { startTime: 'desc' },
    });
  }

  verifyAllShifts() {
    return this.verifyShiftUC.verifyAll();
  }

  getHistory(id?: string) {
    return this.verifyShiftUC.history(id);
  }
}
