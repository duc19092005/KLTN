import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, UserRole, UserStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateStaffDto, UpdateStaffDto } from './staff.dto';
import { BlockchainService } from '../blockchain/blockchain.service';

@Injectable()
export class StaffService {
  constructor(
    private prisma: PrismaService,
    private blockchainService: BlockchainService,
  ) {}

  async create(dto: CreateStaffDto, actorId?: string) {
    if (dto.departmentId) await this.ensureDepartment(dto.departmentId);
    const staff = await this.prisma.user.create({
      data: {
        username: dto.username.trim(),
        email: dto.email.trim().toLowerCase(),
        role: await this.inferRole(dto.departmentId, dto.position),
        status: UserStatus.ACTIVE,
        firstLogin: true,
        staffProfile: {
          create: {
            fullName: dto.fullName.trim(),
            employeeCode: await this.generateEmployeeCode(),
            departmentId: dto.departmentId || null,
            phone: dto.phone.trim(),
            gender: dto.gender.trim(),
            citizenId: dto.citizenId.trim(),
            birthDate: new Date(dto.birthDate),
            address: dto.address?.trim(),
            position: dto.position,
          },
        },
      },
      include: this.includeRelations(),
    });
    await this.audit(actorId, 'STAFF_CREATE', staff.staffProfile?.id || staff.id, dto);
    return staff;
  }

  async search(query: { employeeCode?: string; fullName?: string; department?: string; role?: string; page?: number; limit?: number }) {
    const page = Math.max(Number(query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(query.limit) || 10, 1), 100);
    const where: Prisma.StaffProfileWhereInput = {
      ...(query.employeeCode ? { employeeCode: { contains: query.employeeCode, mode: 'insensitive' } } : {}),
      ...(query.fullName ? { fullName: { contains: query.fullName, mode: 'insensitive' } } : {}),
      ...(query.department ? { department: { name: { contains: query.department, mode: 'insensitive' } } } : {}),
      ...(query.role ? { user: { role: query.role as any } } : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.staffProfile.findMany({
        where,
        include: this.includeRelationsForProfile(),
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.staffProfile.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.max(Math.ceil(total / limit), 1),
    };
  }

  async update(id: string, dto: UpdateStaffDto, actorId?: string) {
    const staff = await this.ensureStaff(id);
    if (dto.departmentId) await this.ensureDepartment(dto.departmentId);
    const updated = await this.prisma.user.update({
      where: { id: staff.userId },
      data: {
        ...(dto.username !== undefined ? { username: dto.username.trim() } : {}),
        ...(dto.email !== undefined ? { email: dto.email.trim().toLowerCase() } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        staffProfile: {
          update: {
            ...(dto.fullName !== undefined ? { fullName: dto.fullName.trim() } : {}),
            ...(dto.departmentId !== undefined ? { departmentId: dto.departmentId || null } : {}),
            ...(dto.phone !== undefined ? { phone: dto.phone.trim() } : {}),
            ...(dto.gender !== undefined ? { gender: dto.gender.trim() } : {}),
            ...(dto.citizenId !== undefined ? { citizenId: dto.citizenId.trim() } : {}),
            ...(dto.birthDate !== undefined ? { birthDate: new Date(dto.birthDate) } : {}),
            ...(dto.address !== undefined ? { address: dto.address?.trim() } : {}),
            ...(dto.position !== undefined ? { position: dto.position } : {}),
          },
        },
      },
      include: this.includeRelations(),
    });
    await this.audit(actorId, 'STAFF_UPDATE', id, dto);
    return updated;
  }

  async setStatus(id: string, status: UserStatus, actorId?: string) {
    const staff = await this.ensureStaff(id);
    const updated = await this.prisma.user.update({
      where: { id: staff.userId },
      data: { status, tokenVersion: { increment: 1 } },
      include: this.includeRelations(),
    });
    await this.audit(actorId, `STAFF_${status}`, id);
    return updated;
  }

  async remove(id: string, actorId?: string) {
    return this.setStatus(id, UserStatus.INACTIVE, actorId);
  }

  private async generateEmployeeCode(): Promise<string> {
    const latest = await this.prisma.staffProfile.findFirst({
      where: { employeeCode: { startsWith: 'NV-' } },
      orderBy: { employeeCode: 'desc' },
      select: { employeeCode: true },
    });
    const lastNumber = Number(latest?.employeeCode?.replace('NV-', '') || '0');
    return `NV-${String(lastNumber + 1).padStart(4, '0')}`;
  }

  private async ensureDepartment(departmentId: string) {
    const department = await this.prisma.department.findUnique({ where: { id: departmentId } });
    if (!department) throw new NotFoundException('Department not found');
    return department;
  }

  private async inferRole(departmentId?: string, position?: string): Promise<UserRole> {
    const normalizedPosition = (position || '').toLowerCase();
    if (normalizedPosition.includes('lễ tân') || normalizedPosition.includes('reception')) {
      return UserRole.RECEPTIONIST;
    }
    if (normalizedPosition.includes('bác sĩ') || normalizedPosition.includes('doctor')) {
      return UserRole.DOCTOR;
    }
    if (normalizedPosition.includes('manager') || normalizedPosition.includes('quản lý') || normalizedPosition.includes('trưởng')) {
      return UserRole.LAB_MANAGER;
    }

    if (departmentId) {
      const department = await this.prisma.department.findUnique({ where: { id: departmentId } });
      const name = department?.name.toLowerCase() || '';
      if (name.includes('reception')) return UserRole.RECEPTIONIST;
      if (name.includes('dermatology')) return UserRole.DOCTOR;
      if (name.includes('lab') || name.includes('test') || name.includes('x-ray') || name.includes('mri')) {
        return UserRole.TECHNICIAN;
      }
    }

    return UserRole.TECHNICIAN;
  }

  private async ensureStaff(id: string) {
    const staff = await this.prisma.staffProfile.findUnique({ where: { id } });
    if (!staff) throw new NotFoundException('Staff not found');
    return staff;
  }

  private includeRelations() {
    return { staffProfile: { include: { department: true, managedDepartment: true } } } as const;
  }

  private includeRelationsForProfile() {
    return { user: true, department: true, managedDepartment: true } as const;
  }

  private async audit(actorId: string | undefined, action: string, entityId: string, metadata?: unknown) {
    const onChain = await this.blockchainService.recordActionAsSuperAdmin({
      action,
      entity: 'StaffProfile',
      entityId,
      actorId,
      metadata,
      timestamp: new Date().toISOString(),
    });

    await this.prisma.auditLog.create({
      data: {
        actorId,
        action,
        entity: 'StaffProfile',
        entityId,
        metadata: {
          payload: metadata as object,
          backendSignedBy: this.blockchainService.getSuperAdminAddress(),
          onChain,
        },
      },
    });
  }
}
