import { BadRequestException, Injectable } from '@nestjs/common';
import { MedicalOrderStatus, Prisma, VisitStatus } from '@prisma/client';
import { PrismaService } from '../../../../infrastructure/prisma/prisma.service';
import {
  CreateOrderCommand,
  CreateResultCommand,
  CreateResultTransactionPayload,
  MedicalOrderRepositoryPort,
  OrderListFilter,
  OrderVisitInfo,
  ResultFileWithOrder,
  StaffIdentity,
} from '../../application/ports/medical-order.repository.port';

/**
 * Prisma-backed MedicalOrder repository. Preserves the include shapes, unique
 * code generation, and the two multi-step transactions (order+visit transition,
 * result+order+visit transition) from the former MedicalOrderService.
 */
@Injectable()
export class PrismaMedicalOrderRepository implements MedicalOrderRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async findVisitForOrder(visitId: string): Promise<OrderVisitInfo | null> {
    const visit = await this.prisma.visit.findUnique({
      where: { id: visitId },
      select: { id: true, patientId: true, departmentId: true, staffId: true, status: true },
    });
    return visit;
  }

  async findDoctorIdByUserId(userId: string): Promise<string | null> {
    const doctor = await this.prisma.doctorProfile.findFirst({ where: { staffProfile: { userId } }, select: { id: true } });
    return doctor?.id ?? null;
  }

  async findDoctorStaffByUserId(userId: string) {
    const doctor = await this.prisma.doctorProfile.findFirst({
      where: { staffProfile: { userId } },
      select: { id: true, staffProfile: { select: { id: true, departmentId: true } } },
    });
    if (!doctor) return null;
    return {
      doctorId: doctor.id,
      staffId: doctor.staffProfile.id,
      departmentId: doctor.staffProfile.departmentId,
    };
  }

  async findStaffByUserId(userId: string): Promise<StaffIdentity | null> {
    return this.prisma.staffProfile.findUnique({ where: { userId }, select: { id: true, userId: true, departmentId: true } });
  }

  async findOrderDepartment(id: string) {
    return this.prisma.department.findUnique({
      where: { id },
      select: { id: true, type: true, status: true, canReceiveOrders: true },
    });
  }

  async findActiveApprovedShift(shiftId: string, now: Date, includeOutOfWindow = false) {
    return this.prisma.staffShift.findFirst({
      where: {
        id: shiftId,
        shiftType: 'PARACLINICAL',
        status: 'APPROVED',
        isActive: true,
        ...(includeOutOfWindow ? {} : {
          startTime: { lte: now },
          endTime: { gte: now },
        }),
      },
      select: {
        id: true,
        staffId: true,
        departmentId: true,
        staff: { select: { userId: true, departmentId: true } },
      },
    });
  }

  async findActiveApprovedShiftForStaffDepartment(staffId: string, departmentId: string, now: Date, includeOutOfWindow = false) {
    return this.prisma.staffShift.findFirst({
      where: {
        staffId,
        departmentId,
        shiftType: 'PARACLINICAL',
        status: 'APPROVED',
        isActive: true,
        ...(includeOutOfWindow ? {} : {
          startTime: { lte: now },
          endTime: { gte: now },
        }),
      },
      select: {
        id: true,
        staffId: true,
        departmentId: true,
        staff: { select: { userId: true, departmentId: true } },
      },
    });
  }

  async departmentExists(id: string): Promise<boolean> {
    const department = await this.prisma.department.findUnique({ where: { id }, select: { id: true } });
    return Boolean(department);
  }

  async createOrderWithVisitTransition(command: CreateOrderCommand): Promise<unknown> {
    const maxAttempts = 5;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        return await this.prisma.$transaction(async (tx) => {
          const orderCode = await this.generateOrderCode(tx);
          const order = await tx.medicalOrder.create({
            data: {
              orderCode,
              visitId: command.visitId,
              patientId: command.patientId,
              doctorId: command.doctorId,
              targetDepartmentId: command.targetDepartmentId || null,
              orderType: command.orderType,
              priority: command.priority || 'NORMAL',
              clinicalNote: command.clinicalNote || null,
              status: MedicalOrderStatus.ORDERED,
            },
            include: this.includeRelations(),
          });

          await tx.visit.update({
            where: { id: command.visitId },
            data: {
              status: VisitStatus.WAITING_TEST_RESULT,
              ...(command.staffId ? { staffId: command.staffId } : {}),
            },
          });

          return order;
        });
      } catch (error) {
        if (!this.isUniqueOrderCodeConflict(error) || attempt === maxAttempts) throw error;
      }
    }

    throw new BadRequestException('Không thể tạo mã phiếu chỉ định duy nhất.');
  }

  async findAll(filter: OrderListFilter): Promise<unknown[]> {
    const where: Prisma.MedicalOrderWhereInput = {
      ...(filter.status ? { status: filter.status } : {}),
      ...(filter.visitId ? { visitId: filter.visitId } : {}),
      ...(filter.targetDepartmentId ? { targetDepartmentId: filter.targetDepartmentId } : {}),
      ...(filter.doctorId ? { doctorId: filter.doctorId } : {}),
    };

    return this.prisma.medicalOrder.findMany({
      where,
      include: this.includeRelations(),
      orderBy: [{ status: 'asc' }, { orderedAt: 'desc' }],
    });
  }

  async findOrderForManage(id: string) {
    const order = await this.prisma.medicalOrder.findUnique({
      where: { id },
      select: { id: true, targetDepartmentId: true, status: true, visitId: true },
    });
    return order;
  }

  async updateStatus(id: string, status: MedicalOrderStatus, completedAt?: Date): Promise<unknown> {
    return this.prisma.medicalOrder.update({
      where: { id },
      data: { status, completedAt },
      include: this.includeRelations(),
    });
  }

  async createResultWithTransitions(
    command: CreateResultCommand,
    visitId: string,
    afterWrite?: (payload: CreateResultTransactionPayload, tx: Prisma.TransactionClient) => Promise<void>,
  ): Promise<unknown> {
    return this.prisma.$transaction(async (tx) => {
      const resultCode = await this.generateResultCode(tx);
      const result = await tx.medicalResult.create({
        data: {
          resultCode,
          orderId: command.orderId,
          performedById: command.performedById,
          note: command.note || null,
          files: {
            create: command.files.map((file) => ({
              fileName: file.fileName,
              originalName: file.originalName,
              mimeType: file.mimeType,
              size: file.size,
              url: file.url,
            })),
          },
        },
        include: { files: true },
      });

      const updatedOrder = await tx.medicalOrder.update({
        where: { id: command.orderId },
        data: { status: MedicalOrderStatus.RESULT_READY },
        include: this.includeRelations(),
      });

      let visitTransition: CreateResultTransactionPayload['visitTransition'] = null;
      if (await this.areAllNonCancelledOrdersReady(tx, visitId)) {
        await tx.visit.update({
          where: { id: visitId },
          data: { status: VisitStatus.WAITING_CONCLUSION },
        });
        visitTransition = { visitId, status: VisitStatus.WAITING_CONCLUSION };
      }

      await afterWrite?.({ result, order: updatedOrder, visitTransition }, tx);

      return { result, order: updatedOrder };
    });
  }

  async findResultFileWithOrder(fileId: string): Promise<ResultFileWithOrder> {
    const file = await this.prisma.medicalResultFile.findUnique({
      where: { id: fileId },
      include: { result: { include: { order: true } } },
    });
    if (!file || !file.result?.order) return null;
    const order = file.result.order;
    return {
      id: file.id,
      fileName: file.fileName,
      originalName: file.originalName,
      mimeType: file.mimeType,
      order: { id: order.id, doctorId: order.doctorId, targetDepartmentId: order.targetDepartmentId },
    };
  }

  private async areAllNonCancelledOrdersReady(tx: Prisma.TransactionClient, visitId: string) {
    const blockingOrder = await tx.medicalOrder.findFirst({
      where: {
        visitId,
        status: { notIn: [MedicalOrderStatus.CANCELLED, MedicalOrderStatus.RESULT_READY] },
      },
      select: { id: true },
    });
    return !blockingOrder;
  }

  private isUniqueOrderCodeConflict(error: unknown) {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002' &&
      Array.isArray(error.meta?.target) &&
      (error.meta.target as string[]).includes('orderCode')
    );
  }

  private includeRelations() {
    return {
      visit: { include: { department: true, staff: { include: { doctorProfile: true } } } },
      patient: true,
      doctor: { include: { staffProfile: { include: { department: true } } } },
      targetDepartment: true,
      results: { include: { files: true, performedBy: { select: { id: true, username: true, email: true, role: true } } }, orderBy: { returnedAt: 'desc' } },
    } as const;
  }

  private async generateOrderCode(tx: Prisma.TransactionClient) {
    const latest = await tx.medicalOrder.findFirst({ where: { orderCode: { startsWith: 'ORD-' } }, orderBy: { orderCode: 'desc' }, select: { orderCode: true } });
    const lastNumber = Number(latest?.orderCode?.replace('ORD-', '') || '0');
    return `ORD-${String(lastNumber + 1).padStart(5, '0')}`;
  }

  private async generateResultCode(tx: Prisma.TransactionClient) {
    const latest = await tx.medicalResult.findFirst({ where: { resultCode: { startsWith: 'RES-' } }, orderBy: { resultCode: 'desc' }, select: { resultCode: true } });
    const lastNumber = Number(latest?.resultCode?.replace('RES-', '') || '0');
    return `RES-${String(lastNumber + 1).padStart(5, '0')}`;
  }
}
