import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AssignDepartmentManagerDto, CreateDepartmentDto, UpdateDepartmentDto } from './department.dto';

@Injectable()
export class DepartmentsService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateDepartmentDto, actorId?: string) {
    const department = await this.prisma.department.create({
      data: {
        name: dto.name.trim(),
        description: dto.description?.trim(),
        managerId: dto.managerId,
      },
      include: this.includeRelations(),
    });
    await this.audit(actorId, 'DEPARTMENT_CREATE', department.id, dto);
    return department;
  }

  async findAll() {
    return this.prisma.department.findMany({
      include: this.includeRelations(),
      orderBy: { name: 'asc' },
    });
  }

  async findStaffs(id: string) {
    await this.ensureDepartment(id);
    return this.prisma.staffProfile.findMany({
      where: { departmentId: id },
      include: { user: true, department: true },
      orderBy: { fullName: 'asc' },
    });
  }

  async update(id: string, dto: UpdateDepartmentDto, actorId?: string) {
    await this.ensureDepartment(id);
    const department = await this.prisma.department.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.description !== undefined ? { description: dto.description?.trim() } : {}),
      },
      include: this.includeRelations(),
    });
    await this.audit(actorId, 'DEPARTMENT_UPDATE', id, dto);
    return department;
  }

  async assignManager(id: string, dto: AssignDepartmentManagerDto, actorId?: string) {
    await this.ensureDepartment(id);
    if (dto.managerId) {
      const staff = await this.prisma.staffProfile.findUnique({ where: { id: dto.managerId } });
      if (!staff) throw new NotFoundException('Staff manager not found');
      if (staff.departmentId && staff.departmentId !== id) {
        throw new BadRequestException('Manager must belong to this department or have no department assigned');
      }
      if (!staff.departmentId) {
        await this.prisma.staffProfile.update({ where: { id: staff.id }, data: { departmentId: id } });
      }
    }

    const department = await this.prisma.department.update({
      where: { id },
      data: { managerId: dto.managerId || null },
      include: this.includeRelations(),
    });
    await this.audit(actorId, 'DEPARTMENT_ASSIGN_MANAGER', id, dto);
    return department;
  }

  async remove(id: string, actorId?: string) {
    await this.ensureDepartment(id);
    const staffCount = await this.prisma.staffProfile.count({ where: { departmentId: id } });
    if (staffCount > 0) {
      throw new BadRequestException(`Không thể xóa phòng ban vì còn ${staffCount} nhân sự.`);
    }
    await this.prisma.department.delete({ where: { id } });
    await this.audit(actorId, 'DEPARTMENT_DELETE', id);
    return { deleted: true };
  }

  private async ensureDepartment(id: string) {
    const department = await this.prisma.department.findUnique({ where: { id } });
    if (!department) throw new NotFoundException('Department not found');
    return department;
  }

  private includeRelations() {
    return {
      manager: { include: { user: true } },
      staffs: { include: { user: true } },
    } as const;
  }

  private async audit(actorId: string | undefined, action: string, entityId: string, metadata?: unknown) {
    await this.prisma.auditLog.create({
      data: { actorId, action, entity: 'Department', entityId, metadata: metadata as object },
    });
  }
}
