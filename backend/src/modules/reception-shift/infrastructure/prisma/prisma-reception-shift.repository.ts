import { Injectable } from '@nestjs/common';
import { ShiftStatus } from '@prisma/client';
import { PrismaService } from '../../../../infrastructure/prisma/prisma.service';
import {
  CreateReceptionShiftData,
  ListReceptionShiftsFilter,
  ReceptionShiftRepositoryPort,
  ReceptionShiftWithRelations,
} from '../../application/ports/reception-shift.repository.port';

@Injectable()
export class PrismaReceptionShiftRepository implements ReceptionShiftRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreateReceptionShiftData): Promise<ReceptionShiftWithRelations> {
    return this.prisma.receptionShift.create({
      data: {
        staffId: data.staffId,
        departmentId: data.departmentId,
        startTime: data.startTime,
        endTime: data.endTime,
        status: data.status,
        note: data.note ?? null,
        approvedById: data.approvedById ?? null,
      },
      include: { staff: true, department: true, approvedBy: { select: { id: true, username: true } } },
    });
  }

  async findById(id: string): Promise<ReceptionShiftWithRelations | null> {
    return this.prisma.receptionShift.findUnique({
      where: { id },
      include: { staff: true, department: true, approvedBy: { select: { id: true, username: true } } },
    });
  }

  async list(filter: ListReceptionShiftsFilter): Promise<ReceptionShiftWithRelations[]> {
    const where: any = { isActive: true };
    if (filter.staffId) where.staffId = filter.staffId;
    if (filter.departmentId) where.departmentId = filter.departmentId;
    if (filter.status) where.status = filter.status;
    if (filter.fromDate || filter.toDate) {
      where.startTime = {};
      if (filter.fromDate) where.startTime.gte = filter.fromDate;
      if (filter.toDate) where.startTime.lte = filter.toDate;
    }
    return this.prisma.receptionShift.findMany({
      where,
      include: { staff: true, department: true, approvedBy: { select: { id: true, username: true } } },
      orderBy: { startTime: 'desc' },
      take: 200,
    });
  }

  async findOverlapping(
    staffId: string,
    startTime: Date,
    endTime: Date,
    excludeId?: string,
  ): Promise<ReceptionShiftWithRelations | null> {
    return this.prisma.receptionShift.findFirst({
      where: {
        staffId,
        isActive: true,
        status: { in: ['PENDING', 'APPROVED'] },
        // Overlap: existing.startTime < newEndTime AND existing.endTime > newStartTime
        startTime: { lt: endTime },
        endTime: { gt: startTime },
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      include: { department: true },
    });
  }

  async updateStatus(
    id: string,
    status: ShiftStatus,
    approvedById: string | null,
    rejectionReason?: string | null,
  ): Promise<ReceptionShiftWithRelations> {
    return this.prisma.receptionShift.update({
      where: { id },
      data: {
        status,
        approvedById,
        rejectionReason: rejectionReason ?? null,
      },
      include: { staff: true, department: true, approvedBy: { select: { id: true, username: true } } },
    });
  }

  async cancel(id: string, staffId: string): Promise<ReceptionShiftWithRelations> {
    return this.prisma.receptionShift.update({
      where: { id },
      data: { isActive: false },
      include: { staff: true, department: true },
    });
  }

  async countTodayByDepartment(departmentId: string, day: Date): Promise<number> {
    const startOfDay = new Date(day);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(day);
    endOfDay.setHours(23, 59, 59, 999);
    return this.prisma.receptionShift.count({
      where: {
        departmentId,
        isActive: true,
        status: 'APPROVED',
        startTime: { gte: startOfDay, lte: endOfDay },
      },
    });
  }
}
