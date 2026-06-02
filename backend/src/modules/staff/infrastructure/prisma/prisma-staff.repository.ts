import { Injectable } from '@nestjs/common';
import { Prisma, UserRole, UserStatus } from '@prisma/client';
import { PrismaService } from '../../../../infrastructure/prisma/prisma.service';
import {
  CreateStaffData,
  StaffListFilter,
  StaffRepositoryPort,
  UpdateStaffData,
} from '../../application/ports/staff.repository.port';

/**
 * Prisma-backed StaffProfile repository. Preserves include shapes, the create
 * transaction, uniqueness queries, employee-code generation, and user
 * sanitization from the former StaffService.
 */
@Injectable()
export class PrismaStaffRepository implements StaffRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async findByIdWithUserDoctor(id: string): Promise<any | null> {
    return this.prisma.staffProfile.findUnique({ where: { id }, include: { user: true, doctorProfile: true } });
  }

  async findByIdWithStaffRelations(id: string): Promise<any | null> {
    return this.prisma.staffProfile.findUnique({ where: { id }, include: this.includeStaff() });
  }

  async departmentExists(id: string): Promise<boolean> {
    return Boolean(await this.prisma.department.findUnique({ where: { id }, select: { id: true } }));
  }

  async findDepartment(id: string): Promise<{ id: string; type: string; specialty?: string | null } | null> {
    const dept = await this.prisma.department.findUnique({ where: { id }, select: { id: true, type: true, specialty: true } });
    if (!dept) return null;
    return { id: dept.id, type: dept.type, specialty: dept.specialty };
  }

  async findUserByUsernameOrEmail(username?: string, email?: string) {
    const checks: Prisma.UserWhereInput[] = [];
    if (username) checks.push({ username: username.trim() });
    if (email) checks.push({ email: email.trim().toLowerCase() });
    if (checks.length === 0) return null;
    return this.prisma.user.findFirst({ where: { OR: checks }, select: { id: true } });
  }

  async findStaffByCitizenId(citizenId: string) {
    return this.prisma.staffProfile.findUnique({ where: { citizenId: citizenId.trim() }, select: { id: true } });
  }

  async findStaffByEmployeeCode(employeeCode: string) {
    return this.prisma.staffProfile.findUnique({ where: { employeeCode: employeeCode.trim() }, select: { id: true } });
  }

  async generateEmployeeCode(role: UserRole): Promise<string> {
    const prefix = role === UserRole.DOCTOR ? 'BS' : 'NV';
    const latest = await this.prisma.staffProfile.findFirst({ where: { employeeCode: { startsWith: `${prefix}-` } }, orderBy: { employeeCode: 'desc' }, select: { employeeCode: true } });
    const lastNumber = Number(latest?.employeeCode?.replace(`${prefix}-`, '') || '0');
    return `${prefix}-${String(lastNumber + 1).padStart(4, '0')}`;
  }

  async createStaffUser(data: CreateStaffData): Promise<any> {
    const user = await this.prisma.$transaction(async (tx) => {
      return tx.user.create({
        data: {
          username: data.username.trim(),
          email: data.email.trim().toLowerCase(),
          passwordHash: data.passwordHash,
          role: data.role,
          status: UserStatus.ACTIVE,
          firstLogin: true,
          staffProfile: {
            create: {
              employeeCode: data.employeeCode,
              fullName: data.fullName.trim(),
              phone: data.phone.trim(),
              gender: data.gender.trim(),
              citizenId: data.citizenId.trim(),
              birthDate: new Date(data.birthDate),
              address: data.address?.trim(),
              avatarUrl: data.avatarUrl.trim(),
              departmentId: data.departmentId || null,
              position: data.position?.trim(),
            },
          },
        },
        include: this.includeUserStaff(),
      });
    });
    return this.sanitizeUser(user);
  }

  async findManyPaginated(filter: StaffListFilter, skip: number, take: number) {
    const where: Prisma.StaffProfileWhereInput = {
      ...(filter.employeeCode ? { employeeCode: { contains: filter.employeeCode, mode: 'insensitive' } } : {}),
      ...(filter.fullName ? { fullName: { contains: filter.fullName, mode: 'insensitive' } } : {}),
      ...(filter.citizenId ? { citizenId: { contains: filter.citizenId, mode: 'insensitive' } } : {}),
      ...(filter.department ? { department: { name: { contains: filter.department, mode: 'insensitive' } } } : {}),
      ...(filter.role ? { user: { role: filter.role } } : {}),
      ...(filter.search
        ? {
          OR: [
            { employeeCode: { contains: filter.search, mode: 'insensitive' } },
            { fullName: { contains: filter.search, mode: 'insensitive' } },
            { citizenId: { contains: filter.search, mode: 'insensitive' } },
          ],
        }
        : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.staffProfile.findMany({ where, include: this.includeStaff(), orderBy: { createdAt: 'desc' }, skip, take }),
      this.prisma.staffProfile.count({ where }),
    ]);
    return { items, total };
  }

  async updateStaffUser(userId: string, data: UpdateStaffData): Promise<any> {
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(data.username !== undefined ? { username: data.username.trim() } : {}),
        ...(data.email !== undefined ? { email: data.email.trim().toLowerCase() } : {}),
        ...(data.role !== undefined ? { role: data.role } : {}),
        ...(data.status !== undefined ? { status: data.status, tokenVersion: { increment: 1 } } : {}),
        staffProfile: {
          update: {
            ...(data.fullName !== undefined ? { fullName: data.fullName.trim() } : {}),
            ...(data.phone !== undefined ? { phone: data.phone.trim() } : {}),
            ...(data.gender !== undefined ? { gender: data.gender.trim() } : {}),
            ...(data.citizenId !== undefined ? { citizenId: data.citizenId.trim() } : {}),
            ...(data.birthDate !== undefined ? { birthDate: new Date(data.birthDate) } : {}),
            ...(data.address !== undefined ? { address: data.address?.trim() } : {}),
            ...(data.avatarUrl !== undefined ? { avatarUrl: data.avatarUrl.trim() } : {}),
            ...(data.departmentId !== undefined ? { departmentId: data.departmentId || null } : {}),
            ...(data.position !== undefined ? { position: data.position?.trim() } : {}),
          },
        },
      },
      include: this.includeUserStaff(),
    });
    return this.sanitizeUser(updated);
  }

  async setUserStatus(userId: string, status: UserStatus): Promise<any> {
    const updated = await this.prisma.user.update({ where: { id: userId }, data: { status, tokenVersion: { increment: 1 } }, include: this.includeUserStaff() });
    return this.sanitizeUser(updated);
  }

  async findAllOrdered(): Promise<any[]> {
    return this.prisma.staffProfile.findMany({ orderBy: { employeeCode: 'asc' } });
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
}
