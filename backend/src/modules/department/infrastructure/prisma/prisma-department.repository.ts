import { Injectable } from '@nestjs/common';
import { Prisma, UserRole } from '@prisma/client';
import { PrismaService } from '../../../../infrastructure/prisma/prisma.service';
import {
  CreateDepartmentData,
  DepartmentListFilter,
  DepartmentRepositoryPort,
  StaffProfileInfo,
  UpdateDepartmentData,
} from '../../application/ports/department.repository.port';

/**
 * Prisma-backed Department repository. Preserves include shapes, uniqueness
 * queries, the create transaction (with inline manager assignment), and the
 * BlockchainLogger FK-detach on delete from the former DepartmentService.
 */
@Injectable()
export class PrismaDepartmentRepository implements DepartmentRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<any | null> {
    return this.prisma.department.findUnique({ where: { id } });
  }

  async findByIdOrThrow(id: string): Promise<any> {
    return this.prisma.department.findUniqueOrThrow({ where: { id }, include: this.includeRelations() });
  }

  async findByName(name: string) {
    return this.prisma.department.findUnique({ where: { name: name.trim() }, select: { id: true } });
  }

  async findByDepartmentCode(code: string) {
    return this.prisma.department.findUnique({ where: { departmentCode: code.trim() }, select: { id: true } });
  }

  async findStaffById(id: string): Promise<StaffProfileInfo | null> {
    const row = await this.prisma.staffProfile.findUnique({
      where: { id },
      select: { id: true, departmentId: true, user: { select: { role: true } } },
    });
    if (!row) return null;
    return { id: row.id, departmentId: row.departmentId, userRole: row.user?.role };
  }

  async findDepartmentByManagerId(managerId: string) {
    return this.prisma.department.findFirst({ where: { managerId }, select: { id: true } });
  }

  async countStaff(departmentId: string): Promise<number> {
    return this.prisma.staffProfile.count({ where: { departmentId } });
  }

  async createWithManager(data: CreateDepartmentData): Promise<any> {
    return this.prisma.$transaction(async (tx) => {
      const dept = await tx.department.create({
        data: {
          departmentCode: data.departmentCode.trim(),
          name: data.name.trim(),
          floor: data.floor?.trim(),
          status: data.status,
          type: data.type,
          canReceiveOrders: data.canReceiveOrders,
          description: data.description?.trim(),
          managerId: data.managerId || null,
        },
        include: this.includeRelations(),
      });

      if (data.managerId) {
        await tx.staffProfile.update({ where: { id: data.managerId }, data: { departmentId: dept.id } });
      }

      return tx.department.findUniqueOrThrow({ where: { id: dept.id }, include: this.includeRelations() });
    });
  }

  async findManyPaginated(filter: DepartmentListFilter, skip: number, take: number) {
    const where: Prisma.DepartmentWhereInput = {
      ...(filter.search
        ? {
          OR: [
            { departmentCode: { contains: filter.search, mode: 'insensitive' } },
            { name: { contains: filter.search, mode: 'insensitive' } },
          ],
        }
        : {}),
      ...(filter.departmentCode ? { departmentCode: { contains: filter.departmentCode, mode: 'insensitive' } } : {}),
      ...(filter.name ? { name: { contains: filter.name, mode: 'insensitive' } } : {}),
      ...(filter.status ? { status: filter.status } : {}),
      ...(filter.type ? { type: filter.type } : {}),
      ...(filter.canReceiveOrders !== undefined ? { canReceiveOrders: filter.canReceiveOrders } : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.department.findMany({ where, include: this.includeRelations(), orderBy: { departmentCode: 'asc' }, skip, take }),
      this.prisma.department.count({ where }),
    ]);
    return { items, total };
  }

  async update(id: string, data: UpdateDepartmentData): Promise<any> {
    return this.prisma.department.update({
      where: { id },
      data: {
        ...(data.departmentCode !== undefined ? { departmentCode: data.departmentCode.trim() } : {}),
        ...(data.name !== undefined ? { name: data.name.trim() } : {}),
        ...(data.floor !== undefined ? { floor: data.floor?.trim() } : {}),
        ...(data.status !== undefined ? { status: data.status } : {}),
        ...(data.type !== undefined ? { type: data.type } : {}),
        ...(data.canReceiveOrders !== undefined ? { canReceiveOrders: data.canReceiveOrders } : {}),
        ...(data.description !== undefined ? { description: data.description?.trim() } : {}),
      },
      include: this.includeRelations(),
    });
  }

  async assignManager(id: string, managerId: string | null): Promise<any> {
    return this.prisma.department.update({
      where: { id },
      data: { managerId: managerId || null },
      include: this.includeRelations(),
    });
  }

  async setStaffDepartment(staffId: string, departmentId: string): Promise<void> {
    await this.prisma.staffProfile.update({ where: { id: staffId }, data: { departmentId } });
  }

  async deleteWithLogDetach(id: string): Promise<void> {
    // BlockchainLogger rows reference the department via FK; detach them so the delete
    // succeeds while preserving the historical log entries.
    await this.prisma.blockchainLogger.updateMany({ where: { departmentId: id }, data: { departmentId: null } });
    await this.prisma.department.delete({ where: { id } });
  }

  async findAllOrdered(): Promise<any[]> {
    return this.prisma.department.findMany({ orderBy: { departmentCode: 'asc' } });
  }

  async updateUserRole(userId: string, role: UserRole): Promise<void> {
    await this.prisma.user.update({ where: { id: userId }, data: { role } });
  }

  async findStaffWithUser(staffId: string) {
    return this.prisma.staffProfile.findUnique({
      where: { id: staffId },
      select: {
        id: true,
        userId: true,
        user: { select: { id: true, role: true } },
      },
    });
  }

  private includeRelations() {
    return {
      manager: { include: { user: { select: this.safeUserSelect() }, doctorProfile: true } },
      staffs: { include: { user: { select: this.safeUserSelect() }, doctorProfile: true } },
    } as const;
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
