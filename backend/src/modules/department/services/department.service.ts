import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { OperationalStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { AssignManagerDto, CreateDepartmentDto, DepartmentQueryDto, UpdateDepartmentDto } from '../dto/department.dto';
import { getPagination, paginated } from '../../shared/pagination.dto';

@Injectable()
export class DepartmentService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateDepartmentDto, actorId?: string) {
    await this.assertNameUnique(dto.name);
    await this.assertDepartmentCodeUnique(dto.departmentCode);
    if (dto.managerId) {
      const manager = await this.assertStaffExists(dto.managerId);
      await this.assertManagerAvailable(dto.managerId);
      if (manager.departmentId) {
        throw new BadRequestException('Manager is already assigned to another department');
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const department = await tx.department.create({
        data: {
          departmentCode: dto.departmentCode.trim(),
          name: dto.name.trim(),
          floor: dto.floor?.trim(),
          status: dto.status || OperationalStatus.ACTIVE,
          type: dto.type,
          canReceiveOrders: dto.canReceiveOrders ?? false,
          description: dto.description?.trim(),
          managerId: dto.managerId || null,
        },
        include: this.includeRelations(),
      });

      if (dto.managerId) {
        await tx.staffProfile.update({ where: { id: dto.managerId }, data: { departmentId: department.id } });
      }

      return tx.department.findUniqueOrThrow({ where: { id: department.id }, include: this.includeRelations() });
    });
  }

  async findAll(query: DepartmentQueryDto) {
    const { page, limit, skip } = getPagination(query);
    const where: Prisma.DepartmentWhereInput = {
      ...(query.search
        ? {
            OR: [
              { departmentCode: { contains: query.search, mode: 'insensitive' } },
              { name: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(query.departmentCode ? { departmentCode: { contains: query.departmentCode, mode: 'insensitive' } } : {}),
      ...(query.name ? { name: { contains: query.name, mode: 'insensitive' } } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.type ? { type: query.type } : {}),
      ...(query.canReceiveOrders !== undefined ? { canReceiveOrders: query.canReceiveOrders } : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.department.findMany({ where, include: this.includeRelations(), orderBy: { departmentCode: 'asc' }, skip, take: limit }),
      this.prisma.department.count({ where }),
    ]);
    return paginated(items, total, page, limit);
  }

  async update(id: string, dto: UpdateDepartmentDto, actorId?: string) {
    await this.ensureDepartment(id);
    if (dto.name) await this.assertNameUnique(dto.name, id);
    if (dto.departmentCode) await this.assertDepartmentCodeUnique(dto.departmentCode, id);
    return this.prisma.department.update({
      where: { id },
      data: {
        ...(dto.departmentCode !== undefined ? { departmentCode: dto.departmentCode.trim() } : {}),
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.floor !== undefined ? { floor: dto.floor?.trim() } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        ...(dto.type !== undefined ? { type: dto.type } : {}),
        ...(dto.canReceiveOrders !== undefined ? { canReceiveOrders: dto.canReceiveOrders } : {}),
        ...(dto.description !== undefined ? { description: dto.description?.trim() } : {}),
      },
      include: this.includeRelations(),
    });
  }

  async assignManager(id: string, dto: AssignManagerDto, actorId?: string) {
    await this.ensureDepartment(id);
    if (dto.managerId) {
      const staff = await this.assertStaffExists(dto.managerId);
      await this.assertManagerAvailable(dto.managerId, id);
      if (staff.departmentId && staff.departmentId !== id) {
        throw new BadRequestException('Manager must belong to this department or be unassigned');
      }
      if (!staff.departmentId) await this.prisma.staffProfile.update({ where: { id: staff.id }, data: { departmentId: id } });
    }
    return this.prisma.department.update({
      where: { id },
      data: { managerId: dto.managerId || null },
      include: this.includeRelations(),
    });
  }

  async remove(id: string, actorId?: string) {
    await this.ensureDepartment(id);
    const staffCount = await this.prisma.staffProfile.count({ where: { departmentId: id } });
    if (staffCount > 0) throw new BadRequestException(`Không thể xóa khoa vì còn ${staffCount} nhân sự.`);
    await this.prisma.department.delete({ where: { id } });
    return { deleted: true };
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

  private async ensureDepartment(id: string) {
    const department = await this.prisma.department.findUnique({ where: { id } });
    if (!department) throw new NotFoundException('Department not found');
    return department;
  }

  private async assertStaffExists(id: string) {
    const staff = await this.prisma.staffProfile.findUnique({ where: { id } });
    if (!staff) throw new NotFoundException('Staff profile not found');
    return staff;
  }

  private async assertNameUnique(name: string, excludeId?: string) {
    const existing = await this.prisma.department.findUnique({ where: { name: name.trim() } });
    if (existing && existing.id !== excludeId) throw new ConflictException('Department name already exists');
  }

  private async assertDepartmentCodeUnique(departmentCode: string, excludeId?: string) {
    const existing = await this.prisma.department.findUnique({ where: { departmentCode: departmentCode.trim() } });
    if (existing && existing.id !== excludeId) throw new ConflictException('Department code already exists');
  }

  private async assertManagerAvailable(managerId: string, departmentId?: string) {
    const existing = await this.prisma.department.findFirst({ where: { managerId } });
    if (existing && existing.id !== departmentId) throw new ConflictException('Staff is already manager of another department');
  }
}
