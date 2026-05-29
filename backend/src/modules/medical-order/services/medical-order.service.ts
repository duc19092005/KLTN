import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { MedicalOrderStatus, Prisma, UserRole, VisitStatus } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { CreateMedicalOrderDto, CreateMedicalResultDto, MedicalOrderQueryDto } from '../dto/medical-order.dto';

type AuthUser = { sub: string; role: UserRole | string };
type UploadedMedicalResultFile = {
  filename: string;
  originalname: string;
  mimetype: string;
  size: number;
};

@Injectable()
export class MedicalOrderService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateMedicalOrderDto, doctorUserId: string) {
    const visit = await this.prisma.visit.findUnique({
      where: { id: dto.visitId },
      include: { doctor: { include: { staffProfile: true } }, patient: true },
    });
    if (!visit) throw new NotFoundException('Visit not found');

    const currentDoctor = await this.prisma.doctorProfile.findFirst({
      where: { staffProfile: { userId: doctorUserId } },
    });
    if (!currentDoctor) throw new BadRequestException('Current user does not have doctor profile');
    if (visit.doctorId !== currentDoctor.id) throw new BadRequestException('Doctor can only order tests for own visit');

    if (dto.targetDepartmentId) await this.ensureDepartment(dto.targetDepartmentId);

    const maxAttempts = 5;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        return await this.prisma.$transaction(async (tx) => {
          const orderCode = await this.generateOrderCode(tx);
          const order = await tx.medicalOrder.create({
            data: {
              orderCode,
              visitId: visit.id,
              patientId: visit.patientId,
              doctorId: currentDoctor.id,
              targetDepartmentId: dto.targetDepartmentId || null,
              orderType: dto.orderType.trim(),
              priority: dto.priority?.trim() || 'NORMAL',
              clinicalNote: dto.clinicalNote?.trim() || null,
              status: MedicalOrderStatus.ORDERED,
            },
            include: this.includeRelations(),
          });

          await tx.visit.update({
            where: { id: visit.id },
            data: { status: VisitStatus.WAITING_TEST_RESULT },
          });

          return order;
        });
      } catch (error) {
        if (!this.isUniqueOrderCodeConflict(error) || attempt === maxAttempts) throw error;
      }
    }

    throw new BadRequestException('Cannot generate unique medical order code');
  }

  async findAll(query: MedicalOrderQueryDto, user: AuthUser) {
    const where: Prisma.MedicalOrderWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.visitId ? { visitId: query.visitId } : {}),
      ...(query.targetDepartmentId ? { targetDepartmentId: query.targetDepartmentId } : {}),
    };

    const scopedWhere = await this.applyAccessScope(where, user);

    return this.prisma.medicalOrder.findMany({
      where: scopedWhere,
      include: this.includeRelations(),
      orderBy: [{ status: 'asc' }, { orderedAt: 'desc' }],
    });
  }

  async updateStatus(id: string, status: MedicalOrderStatus, user: AuthUser) {
    const order = await this.ensureOrder(id);
    await this.assertCanManageOrder(order, user);
    if (status === MedicalOrderStatus.COMPLETED && user.role === UserRole.LAB_MANAGER && !order.results?.length) {
      throw new BadRequestException('LAB_MANAGER cannot complete a medical order before uploading at least one result');
    }
    return this.prisma.medicalOrder.update({
      where: { id },
      data: { status, completedAt: status === MedicalOrderStatus.COMPLETED || status === MedicalOrderStatus.CANCELLED ? new Date() : undefined },
      include: this.includeRelations(),
    });
  }

  async createResult(orderId: string, dto: CreateMedicalResultDto, user: AuthUser) {
    const order = await this.ensureOrder(orderId);
    await this.assertCanManageOrder(order, user);
    if (order.status === MedicalOrderStatus.COMPLETED || order.status === MedicalOrderStatus.CANCELLED) {
      throw new BadRequestException('Cannot return result for completed/cancelled order');
    }
    if (!dto.files?.length) throw new BadRequestException('At least one result PDF/image file is required');

    return this.prisma.$transaction(async (tx) => {
      const resultCode = await this.generateResultCode(tx);
      const result = await tx.medicalResult.create({
        data: {
          resultCode,
          orderId,
          performedById: user.sub,
          note: dto.note?.trim() || null,
          files: {
            create: dto.files.map((file) => ({
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
        where: { id: orderId },
        data: { status: MedicalOrderStatus.RESULT_READY },
        include: this.includeRelations(),
      });

      if (await this.areAllNonCancelledOrdersReady(tx, order.visitId)) {
        await tx.visit.update({
          where: { id: order.visitId },
          data: { status: VisitStatus.WAITING_CONCLUSION },
        });
      }

      return { result, order: updatedOrder };
    });
  }

  mapUploadedResultFiles(orderId: string, files: UploadedMedicalResultFile[]) {
    if (!files.length) throw new BadRequestException('Please upload at least one PDF/image file');
    return files.map((file) => ({
      fileName: file.filename,
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      url: `/uploads/medical-results/${file.filename}`,
    }));
  }

  private async ensureDepartment(id: string) {
    const department = await this.prisma.department.findUnique({ where: { id } });
    if (!department) throw new NotFoundException('Target department not found');
  }

  private async ensureOrder(id: string) {
    const order = await this.prisma.medicalOrder.findUnique({ where: { id }, include: this.includeRelations() });
    if (!order) throw new NotFoundException('Medical order not found');
    return order;
  }

  private async areAllNonCancelledOrdersReady(tx: Prisma.TransactionClient, visitId: string) {
    const blockingOrder = await tx.medicalOrder.findFirst({
      where: {
        visitId,
        status: {
          notIn: [MedicalOrderStatus.CANCELLED, MedicalOrderStatus.RESULT_READY, MedicalOrderStatus.COMPLETED],
        },
      },
      select: { id: true },
    });
    return !blockingOrder;
  }

  private async applyAccessScope(where: Prisma.MedicalOrderWhereInput, user: AuthUser) {
    if (user.role === UserRole.ADMIN) return where;

    if (user.role === UserRole.DOCTOR) {
      const doctor = await this.getDoctorByUserId(user.sub);
      return { ...where, doctorId: doctor.id };
    }

    if (user.role === UserRole.LAB_MANAGER) {
      const staff = await this.getStaffByUserId(user.sub);
      if (!staff.departmentId) throw new ForbiddenException('LAB_MANAGER staff profile is not assigned to any department');
      return { ...where, targetDepartmentId: staff.departmentId };
    }

    throw new ForbiddenException('User role is not allowed to access medical orders');
  }

  private async assertCanManageOrder(order: { targetDepartmentId: string | null }, user: AuthUser) {
    if (user.role === UserRole.ADMIN) return;

    if (user.role !== UserRole.LAB_MANAGER) {
      throw new ForbiddenException('Only ADMIN or LAB_MANAGER can update/upload results for medical orders');
    }

    const staff = await this.getStaffByUserId(user.sub);
    if (!staff.departmentId) throw new ForbiddenException('LAB_MANAGER staff profile is not assigned to any department');
    if (!order.targetDepartmentId || order.targetDepartmentId !== staff.departmentId) {
      throw new ForbiddenException('LAB_MANAGER can only process medical orders assigned to their department');
    }
  }

  private async getDoctorByUserId(userId: string) {
    const doctor = await this.prisma.doctorProfile.findFirst({ where: { staffProfile: { userId } }, select: { id: true } });
    if (!doctor) throw new ForbiddenException('Current user does not have doctor profile');
    return doctor;
  }

  private async getStaffByUserId(userId: string) {
    const staff = await this.prisma.staffProfile.findUnique({ where: { userId }, select: { id: true, departmentId: true } });
    if (!staff) throw new ForbiddenException('Current user does not have staff profile');
    return staff;
  }

  private isUniqueOrderCodeConflict(error: unknown) {
    return error instanceof Prisma.PrismaClientKnownRequestError
      && error.code === 'P2002'
      && Array.isArray(error.meta?.target)
      && error.meta.target.includes('orderCode');
  }

  private includeRelations() {
    return {
      visit: { include: { clinicalRoom: true } },
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
