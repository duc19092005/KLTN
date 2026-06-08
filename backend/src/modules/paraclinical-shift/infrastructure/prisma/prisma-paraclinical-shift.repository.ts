import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/prisma/prisma.service';
import {
  AssignShiftData,
  CreateShiftData,
  HandoverLogFull,
  ParaclinicalShiftRepositoryPort,
  ShiftWithStaff,
} from '../../application/ports/paraclinical-shift.repository.port';

const SHIFT_INCLUDE = {
  staff: {
    include: {
      user: {
        select: {
          id: true,
          username: true,
          role: true,
          faceEmbedding: true,
          faceHash: true,
          failedFaceAttempts: true,
          faceLockedUntil: true,
          tokenVersion: true,
        },
      },
      department: { select: { id: true, name: true, type: true } },
      doctorProfile: { select: { id: true } },
    },
  },
  department: { select: { id: true, departmentCode: true, name: true, type: true } },
} as const;

const HANDOVER_INCLUDE = {
  fromStaff: { select: { id: true, fullName: true, userId: true } },
  toStaff: { select: { id: true, fullName: true, userId: true } },
} as const;

@Injectable()
export class PrismaParaclinicalShiftRepository implements ParaclinicalShiftRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async createShift(data: CreateShiftData): Promise<ShiftWithStaff> {
    return this.prisma.paraclinicalShift.create({
      data: {
        staffId: data.staffId,
        departmentId: data.departmentId,
        startTime: data.startTime,
        endTime: data.endTime,
        note: data.note ?? null,
        status: 'PENDING',
      },
      include: SHIFT_INCLUDE,
    }) as any;
  }

  async assignShift(data: AssignShiftData): Promise<ShiftWithStaff> {
    return this.prisma.paraclinicalShift.create({
      data: {
        staffId: data.staffId,
        departmentId: data.departmentId,
        startTime: data.startTime,
        endTime: data.endTime,
        status: 'APPROVED',
        approvedById: data.approvedById,
      },
      include: SHIFT_INCLUDE,
    }) as any;
  }

  async findShiftById(id: string): Promise<ShiftWithStaff | null> {
    return this.prisma.paraclinicalShift.findUnique({ where: { id }, include: SHIFT_INCLUDE }) as any;
  }

  async approveShift(id: string, approvedById: string, hash256: string, dataSalt: string): Promise<ShiftWithStaff> {
    return this.prisma.paraclinicalShift.update({
      where: { id },
      data: { status: 'APPROVED', approvedById, hash256, dataSalt },
      include: SHIFT_INCLUDE,
    }) as any;
  }

  async rejectShift(id: string, approvedById: string, reason?: string | null): Promise<ShiftWithStaff> {
    return this.prisma.paraclinicalShift.update({
      where: { id },
      data: { status: 'REJECTED', approvedById, rejectionReason: reason ?? null, isActive: false },
      include: SHIFT_INCLUDE,
    }) as any;
  }

  async setShiftHash(id: string, hash256: string, dataSalt: string): Promise<ShiftWithStaff> {
    return this.prisma.paraclinicalShift.update({
      where: { id },
      data: { hash256, dataSalt },
      include: SHIFT_INCLUDE,
    }) as any;
  }

  async hardDeleteShift(id: string): Promise<void> {
    await this.prisma.paraclinicalShift.delete({ where: { id } });
  }

  async revertToPending(id: string): Promise<void> {
    await this.prisma.paraclinicalShift.update({
      where: { id },
      data: { status: 'PENDING', approvedById: null, hash256: null, dataSalt: null },
    });
  }

  async findShiftsByDepartment(departmentId: string, from?: Date, to?: Date): Promise<ShiftWithStaff[]> {
    return this.prisma.paraclinicalShift.findMany({
      where: {
        departmentId,
        isActive: true,
        ...(from && to
          ? {
              OR: [
                { startTime: { gte: from, lte: to } },
                { endTime: { gte: from, lte: to } },
                { startTime: { lte: from }, endTime: { gte: to } },
              ],
            }
          : {}),
      },
      include: SHIFT_INCLUDE,
      orderBy: { startTime: 'asc' },
    }) as any;
  }

  async findPendingShifts(departmentId?: string): Promise<ShiftWithStaff[]> {
    return this.prisma.paraclinicalShift.findMany({
      where: {
        status: 'PENDING',
        isActive: true,
        ...(departmentId ? { staff: { departmentId } } : {}),
      },
      include: SHIFT_INCLUDE,
      orderBy: { createdAt: 'asc' },
    }) as any;
  }

  async findActiveShiftForDepartment(departmentId: string, now: Date): Promise<ShiftWithStaff | null> {
    return this.prisma.paraclinicalShift.findFirst({
      where: { departmentId, status: 'APPROVED', isActive: true, startTime: { lte: now }, endTime: { gte: now } },
      include: SHIFT_INCLUDE,
    }) as any;
  }

  async findActiveShiftsForDepartment(departmentId: string, now: Date): Promise<ShiftWithStaff[]> {
    return this.prisma.paraclinicalShift.findMany({
      where: { departmentId, status: 'APPROVED', isActive: true, startTime: { lte: now }, endTime: { gte: now } },
      include: SHIFT_INCLUDE,
      orderBy: { startTime: 'asc' },
    }) as any;
  }

  async findActiveShiftForStaffDepartment(staffId: string, departmentId: string, now: Date, includeOutOfWindow = false): Promise<ShiftWithStaff | null> {
    return this.prisma.paraclinicalShift.findFirst({
      where: {
        staffId,
        departmentId,
        status: 'APPROVED',
        isActive: true,
        ...(includeOutOfWindow ? {} : { startTime: { lte: now }, endTime: { gte: now } }),
      },
      include: SHIFT_INCLUDE,
      orderBy: { startTime: 'asc' },
    }) as any;
  }

  async hasOverlappingShift(departmentId: string, startTime: Date, endTime: Date, excludeId?: string): Promise<boolean> {
    const count = await this.prisma.paraclinicalShift.count({
      where: {
        departmentId,
        status: 'APPROVED',
        isActive: true,
        ...(excludeId ? { id: { not: excludeId } } : {}),
        OR: [{ startTime: { lt: endTime }, endTime: { gt: startTime } }],
      },
    });
    return count > 0;
  }

  async createHandoverLog(data: {
    departmentId: string;
    fromStaffId: string;
    toStaffId: string;
    reason?: string;
  }): Promise<HandoverLogFull> {
    return this.prisma.handoverLog.create({
      data: {
        departmentId: data.departmentId,
        fromStaffId: data.fromStaffId,
        toStaffId: data.toStaffId,
        reason: data.reason ?? null,
      },
      include: HANDOVER_INCLUDE,
    }) as any;
  }

  async findHandoverById(id: string): Promise<HandoverLogFull | null> {
    return this.prisma.handoverLog.findUnique({ where: { id }, include: HANDOVER_INCLUDE }) as any;
  }

  async markFaceVerifiedA(id: string): Promise<HandoverLogFull> {
    return this.prisma.handoverLog.update({ where: { id }, data: { faceVerifiedA: true }, include: HANDOVER_INCLUDE }) as any;
  }

  async markFaceVerifiedB(id: string): Promise<HandoverLogFull> {
    return this.prisma.handoverLog.update({ where: { id }, data: { faceVerifiedB: true }, include: HANDOVER_INCLUDE }) as any;
  }

  async completeHandover(id: string): Promise<HandoverLogFull> {
    return this.prisma.handoverLog.update({ where: { id }, data: { isCompleted: true }, include: HANDOVER_INCLUDE }) as any;
  }

  async findStaffByUserId(userId: string) {
    return this.prisma.staffProfile.findUnique({
      where: { userId },
      select: { id: true, fullName: true, userId: true, departmentId: true },
    });
  }
}
