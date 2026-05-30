import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { MedicalOrderStatus, Prisma, UserRole, VisitStatus } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { CreateMedicalOrderDto, CreateMedicalResultDto, MedicalOrderQueryDto } from '../dto/medical-order.dto';

type AuthUser = { sub: string; role: UserRole | string };
type UploadedMedicalResultFile = {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
};

type CloudinaryUploadResult = {
  public_id: string;
  secure_url: string;
  resource_type: string;
  format?: string;
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
    if (([VisitStatus.COMPLETED, VisitStatus.CANCELLED] as VisitStatus[]).includes(visit.status)) {
      throw new BadRequestException('Cannot create additional medical orders for a completed/cancelled visit');
    }

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
    return this.prisma.medicalOrder.update({
      where: { id },
      data: { status, completedAt: status === MedicalOrderStatus.RESULT_READY || status === MedicalOrderStatus.CANCELLED ? new Date() : undefined },
      include: this.includeRelations(),
    });
  }

  async createResult(orderId: string, dto: CreateMedicalResultDto, user: AuthUser) {
    const order = await this.ensureOrder(orderId);
    await this.assertCanManageOrder(order, user);
    if (([MedicalOrderStatus.RESULT_READY, MedicalOrderStatus.CANCELLED] as MedicalOrderStatus[]).includes(order.status)) {
      throw new BadRequestException('Cannot return result for an order that is already ready/completed/cancelled');
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

  async mapUploadedResultFiles(orderId: string, files: UploadedMedicalResultFile[]) {
    if (!files.length) throw new BadRequestException('Please upload at least one PDF/image file');
    const order = await this.ensureOrder(orderId);
    if (([MedicalOrderStatus.RESULT_READY, MedicalOrderStatus.CANCELLED] as MedicalOrderStatus[]).includes(order.status)) {
      throw new BadRequestException('Cannot upload files for an order that is already ready/completed/cancelled');
    }

    const uploadedFiles = await Promise.all(files.map((file) => this.uploadFileToCloudinary(file, orderId)));

    return uploadedFiles.map(({ file, cloudinary }) => ({
      fileName: cloudinary.public_id,
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      url: cloudinary.secure_url,
    }));
  }

  // Generates a short-lived signed download URL for a result file.
  // Files are uploaded as `authenticated` (private) on Cloudinary, so they can only
  // be retrieved with a valid signature. This method gates that signature behind
  // an authorization check so only the responsible doctor, the owning lab
  // department, or an admin can obtain a working link.
  async getResultFileDownloadUrl(fileId: string, user: AuthUser) {
    const file = await this.prisma.medicalResultFile.findUnique({
      where: { id: fileId },
      include: { result: { include: { order: true } } },
    });
    if (!file || !file.result?.order) throw new NotFoundException('Result file not found');
    const order = file.result.order;

    if (user.role === UserRole.ADMIN) {
      // allowed
    } else if (user.role === UserRole.DOCTOR) {
      const doctor = await this.getDoctorByUserId(user.sub);
      if (order.doctorId !== doctor.id) {
        throw new ForbiddenException('Doctor can only access result files of their own visits');
      }
    } else if (user.role === UserRole.LAB_MANAGER) {
      await this.assertCanManageOrder(order, user);
    } else {
      throw new ForbiddenException('User role is not allowed to access result files');
    }

    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;
    if (!cloudName || !apiKey || !apiSecret) throw new BadRequestException('Cloudinary is not configured');

    const resourceType = file.mimeType === 'application/pdf' ? 'raw' : 'image';
    const format = this.extractFileFormat(file.originalName, file.mimeType);
    const timestamp = Math.floor(Date.now() / 1000);
    const expiresAt = timestamp + 300; // 5-minute TTL

    const params: Record<string, string> = {
      expires_at: String(expiresAt),
      public_id: file.fileName,
      timestamp: String(timestamp),
      type: 'authenticated',
    };
    if (format) params.format = format;

    const signature = this.signCloudinaryParams(params, apiSecret);
    const query = new URLSearchParams({ ...params, signature, api_key: apiKey }).toString();
    const url = `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/download?${query}`;

    return { url, originalName: file.originalName, expiresAt: new Date(expiresAt * 1000).toISOString() };
  }

  private extractFileFormat(originalName: string, mimeType: string) {
    const ext = originalName.includes('.') ? originalName.split('.').pop()!.toLowerCase() : '';
    if (ext) return ext;
    const map: Record<string, string> = {
      'application/pdf': 'pdf',
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
    };
    return map[mimeType] || '';
  }

  private uploadFileToCloudinary(file: UploadedMedicalResultFile, orderId: string): Promise<{ file: UploadedMedicalResultFile; cloudinary: CloudinaryUploadResult }> {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;
    const uploadPreset = process.env.CLOUDINARY_UPLOAD_PRESET;
    if (!cloudName || !apiKey || !apiSecret) {
      throw new BadRequestException('Cloudinary upload is not configured');
    }

    const timestamp = Math.floor(Date.now() / 1000).toString();
    const folder = 'medical-results';
    const publicId = `${orderId}-${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const resourceType = file.mimetype === 'application/pdf' ? 'raw' : 'image';
    // `type: authenticated` makes the asset private: it cannot be fetched from
    // Cloudinary without a valid signature, preventing public exposure of PHI.
    const paramsToSign: Record<string, string> = { folder, public_id: publicId, timestamp, type: 'authenticated' };
    if (uploadPreset) paramsToSign.upload_preset = uploadPreset;
    const signature = this.signCloudinaryParams(paramsToSign, apiSecret);
    const form = new FormData();
    const fileBuffer = file.buffer.buffer.slice(file.buffer.byteOffset, file.buffer.byteOffset + file.buffer.byteLength) as ArrayBuffer;
    form.append('file', new Blob([fileBuffer], { type: file.mimetype }), file.originalname);
    form.append('api_key', apiKey);
    form.append('timestamp', timestamp);
    form.append('folder', folder);
    form.append('public_id', publicId);
    form.append('type', 'authenticated');
    form.append('signature', signature);
    if (uploadPreset) form.append('upload_preset', uploadPreset);

    return fetch(`https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`, {
      method: 'POST',
      body: form,
    }).then(async (response) => {
      const bodyText = await response.text();
      const body = this.tryParseJson(bodyText);
      if (!response.ok) {
        throw new BadRequestException(`Cloudinary upload failed (${response.status}): ${body?.error?.message || bodyText}`);
      }
      return { file, cloudinary: body as CloudinaryUploadResult };
    });
  }

  private signCloudinaryParams(params: Record<string, string>, apiSecret: string) {
    const crypto = require('crypto') as typeof import('crypto');
    const payload = Object.keys(params)
      .sort()
      .map((key) => `${key}=${params[key]}`)
      .join('&');
    return crypto.createHash('sha1').update(`${payload}${apiSecret}`).digest('hex');
  }

  private tryParseJson(value: string) {
    try {
      return JSON.parse(value);
    } catch {
      return undefined;
    }
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
          notIn: [MedicalOrderStatus.CANCELLED, MedicalOrderStatus.RESULT_READY],
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
