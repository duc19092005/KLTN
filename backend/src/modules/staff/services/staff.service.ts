import * as bcrypt from 'bcrypt';
import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, UserRole, UserStatus } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { getPagination, paginated } from '../../shared/pagination.dto';
import { CreateStaffDto, StaffQueryDto, UpdateStaffDto } from '../dto/staff.dto';

const DEFAULT_STAFF_PASSWORD = '123456';

@Injectable()
export class StaffService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateStaffDto, actorId?: string) {
    if (dto.role === UserRole.ADMIN) {
      throw new BadRequestException('Staff module cannot create ADMIN users');
    }
    if (dto.role === UserRole.DOCTOR) {
      throw new BadRequestException('Use doctor module to create doctors with professional profile');
    }
    if (dto.departmentId) await this.ensureDepartment(dto.departmentId);
    await this.assertUserUnique(dto.username, dto.email);
    await this.assertCitizenIdUnique(dto.citizenId);
    const employeeCode = dto.employeeCode || (await this.generateEmployeeCode(dto.role));
    await this.assertEmployeeCodeUnique(employeeCode);
    const passwordHash = await this.hashPassword(DEFAULT_STAFF_PASSWORD);

    try {
      const user = await this.prisma.$transaction(async (tx) => {
        return tx.user.create({
          data: {
            username: dto.username.trim(),
            email: dto.email.trim().toLowerCase(),
            passwordHash,
            role: dto.role,
            status: UserStatus.ACTIVE,
            firstLogin: true,
            staffProfile: {
              create: {
                employeeCode,
                fullName: dto.fullName.trim(),
                phone: dto.phone.trim(),
                gender: dto.gender.trim(),
                citizenId: dto.citizenId.trim(),
                birthDate: new Date(dto.birthDate),
                address: dto.address?.trim(),
                avatarUrl: dto.avatarUrl.trim(),
                departmentId: dto.departmentId || null,
                position: dto.position?.trim(),
              },
            },
          },
          include: this.includeUserStaff(),
        });
      });

      return this.sanitizeUser(user);
    } catch (error) {
      this.rethrowUniqueConstraint(error);
      throw error;
    }
  }

  async findAll(query: StaffQueryDto) {
    const { page, limit, skip } = getPagination(query);
    const where: Prisma.StaffProfileWhereInput = {
      ...(query.employeeCode ? { employeeCode: { contains: query.employeeCode, mode: 'insensitive' } } : {}),
      ...(query.fullName ? { fullName: { contains: query.fullName, mode: 'insensitive' } } : {}),
      ...(query.citizenId ? { citizenId: { contains: query.citizenId, mode: 'insensitive' } } : {}),
      ...(query.department ? { department: { name: { contains: query.department, mode: 'insensitive' } } } : {}),
      ...(query.role ? { user: { role: query.role } } : {}),
      ...(query.search
        ? {
            OR: [
              { employeeCode: { contains: query.search, mode: 'insensitive' } },
              { fullName: { contains: query.search, mode: 'insensitive' } },
              { citizenId: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.staffProfile.findMany({ where, include: this.includeStaff(), orderBy: { createdAt: 'desc' }, skip, take: limit }),
      this.prisma.staffProfile.count({ where }),
    ]);
    return paginated(items, total, page, limit);
  }

  async update(id: string, dto: UpdateStaffDto, actorId?: string) {
    const staff = await this.ensureStaff(id);
    if (dto.departmentId) await this.ensureDepartment(dto.departmentId);
    if (dto.role === UserRole.ADMIN) {
      throw new BadRequestException('Staff module cannot promote users to ADMIN');
    }
    if (dto.role === UserRole.DOCTOR && staff.user.role !== UserRole.DOCTOR) {
      throw new BadRequestException('Use doctor module to create or promote doctors with professional profile');
    }
    if (staff.doctorProfile && dto.role && dto.role !== UserRole.DOCTOR) {
      throw new BadRequestException('Cannot change doctor role while DoctorProfile exists');
    }
    if (dto.username || dto.email) await this.assertUserUnique(dto.username, dto.email, staff.userId);
    if (dto.citizenId) await this.assertCitizenIdUnique(dto.citizenId, staff.id);

    try {
      const updated = await this.prisma.user.update({
        where: { id: staff.userId },
        data: {
          ...(dto.username !== undefined ? { username: dto.username.trim() } : {}),
          ...(dto.email !== undefined ? { email: dto.email.trim().toLowerCase() } : {}),
          ...(dto.role !== undefined ? { role: dto.role } : {}),
          ...(dto.status !== undefined ? { status: dto.status, tokenVersion: { increment: 1 } } : {}),
          staffProfile: {
            update: {
              ...(dto.fullName !== undefined ? { fullName: dto.fullName.trim() } : {}),
              ...(dto.phone !== undefined ? { phone: dto.phone.trim() } : {}),
              ...(dto.gender !== undefined ? { gender: dto.gender.trim() } : {}),
              ...(dto.citizenId !== undefined ? { citizenId: dto.citizenId.trim() } : {}),
              ...(dto.birthDate !== undefined ? { birthDate: new Date(dto.birthDate) } : {}),
              ...(dto.address !== undefined ? { address: dto.address?.trim() } : {}),
              ...(dto.avatarUrl !== undefined ? { avatarUrl: dto.avatarUrl.trim() } : {}),
              ...(dto.departmentId !== undefined ? { departmentId: dto.departmentId || null } : {}),
              ...(dto.position !== undefined ? { position: dto.position?.trim() } : {}),
            },
          },
        },
        include: this.includeUserStaff(),
      });
      return this.sanitizeUser(updated);
    } catch (error) {
      this.rethrowUniqueConstraint(error);
      throw error;
    }
  }

  async setStatus(id: string, status: UserStatus, actorId?: string) {
    const staff = await this.ensureStaff(id);
    const updated = await this.prisma.user.update({ where: { id: staff.userId }, data: { status, tokenVersion: { increment: 1 } }, include: this.includeUserStaff() });
    return this.sanitizeUser(updated);
  }

  async remove(id: string, actorId?: string) {
    return this.setStatus(id, UserStatus.INACTIVE, actorId);
  }

  private async generateEmployeeCode(role: UserRole) {
    const prefix = role === UserRole.DOCTOR ? 'BS' : 'NV';
    const latest = await this.prisma.staffProfile.findFirst({ where: { employeeCode: { startsWith: `${prefix}-` } }, orderBy: { employeeCode: 'desc' }, select: { employeeCode: true } });
    const lastNumber = Number(latest?.employeeCode?.replace(`${prefix}-`, '') || '0');
    return `${prefix}-${String(lastNumber + 1).padStart(4, '0')}`;
  }

  private hashPassword(password: string) {
    return bcrypt.hash(password, 12);
  }

  private async ensureDepartment(id: string) {
    const department = await this.prisma.department.findUnique({ where: { id } });
    if (!department) throw new NotFoundException('Department not found');
    return department;
  }

  private async ensureStaff(id: string) {
    const staff = await this.prisma.staffProfile.findUnique({ where: { id }, include: { user: true, doctorProfile: true } });
    if (!staff) throw new NotFoundException('Staff profile not found');
    return staff;
  }

  private includeStaff() {
    return { user: { select: this.safeUserSelect() }, department: true, doctorProfile: true, managedDepartment: true } as const;
  }

  private includeUserStaff() {
    return { staffProfile: { include: { department: true, doctorProfile: true, managedDepartment: true } } } as const;
  }

  private sanitizeUser<T extends { passwordHash?: string | null }>(user: T) {
    const { passwordHash, ...safe } = user;
    return safe;
  }

  private safeUserSelect() {
    return {
      id: true,
      username: true,
      email: true,
      role: true,
      status: true,
      firstLogin: true,
      createdAt: true,
      updatedAt: true,
    } as const;
  }

  private async assertUserUnique(username?: string, email?: string, excludeUserId?: string) {
    const checks: Prisma.UserWhereInput[] = [];
    if (username) checks.push({ username: username.trim() });
    if (email) checks.push({ email: email.trim().toLowerCase() });
    if (checks.length === 0) return;

    const existing = await this.prisma.user.findFirst({ where: { OR: checks } });
    if (existing && existing.id !== excludeUserId) {
      throw new ConflictException('Username or email already exists');
    }
  }

  private async assertCitizenIdUnique(citizenId: string, excludeStaffId?: string) {
    const existing = await this.prisma.staffProfile.findUnique({ where: { citizenId: citizenId.trim() } });
    if (existing && existing.id !== excludeStaffId) {
      throw new ConflictException('Citizen ID already exists');
    }
  }

  private async assertEmployeeCodeUnique(employeeCode: string) {
    const existing = await this.prisma.staffProfile.findUnique({ where: { employeeCode: employeeCode.trim() } });
    if (existing) throw new ConflictException('Employee code already exists');
  }

  private rethrowUniqueConstraint(error: unknown) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new ConflictException('Unique constraint violation while saving staff');
    }
  }
}
