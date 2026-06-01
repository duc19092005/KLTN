import { Inject, Injectable } from '@nestjs/common';
import { OperationalStatus } from '@prisma/client';
import { CreateDepartmentDto } from '../../dto/department.dto';
import { DEPARTMENT_REPOSITORY, DepartmentRepositoryPort } from '../ports/department.repository.port';
import { DEPARTMENT_INTEGRITY_ANCHOR, DepartmentIntegrityAnchorPort } from '../ports/department-integrity-anchor.port';
import { DepartmentValidator } from '../services/department.validator';

/**
 * Creates a department (optionally assigning a manager) then anchors the change.
 * Behavior copied verbatim from the former DepartmentService.create().
 */
@Injectable()
export class CreateDepartmentUseCase {
  constructor(
    @Inject(DEPARTMENT_REPOSITORY) private readonly repo: DepartmentRepositoryPort,
    @Inject(DEPARTMENT_INTEGRITY_ANCHOR) private readonly integrity: DepartmentIntegrityAnchorPort,
    private readonly validator: DepartmentValidator,
  ) {}

  async execute(dto: CreateDepartmentDto, actorId?: string) {
    await this.validator.assertNameUnique(dto.name);
    await this.validator.assertDepartmentCodeUnique(dto.departmentCode);
    if (dto.managerId) {
      const manager = await this.validator.assertStaffExists(dto.managerId);
      await this.validator.assertManagerAvailable(dto.managerId);
      this.validator.assertManagerUnassignedForCreate(manager);
    }

    const department = await this.repo.createWithManager({
      departmentCode: dto.departmentCode,
      name: dto.name,
      floor: dto.floor,
      status: dto.status || OperationalStatus.ACTIVE,
      type: dto.type,
      canReceiveOrders: dto.canReceiveOrders ?? false,
      description: dto.description,
      managerId: dto.managerId || null,
    });

    await this.integrity.anchorChange(department, 'CREATE', actorId, null);
    return department;
  }
}
