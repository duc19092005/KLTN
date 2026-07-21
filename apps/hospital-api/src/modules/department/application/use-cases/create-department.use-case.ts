import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { OperationalStatus } from '@prisma/client';
import { CreateDepartmentDto } from '../../dto/department.dto';
import { DEPARTMENT_REPOSITORY, DepartmentRepositoryPort } from '../ports/department.repository.port';
import { DEPARTMENT_INTEGRITY_ANCHOR, DepartmentIntegrityAnchorPort } from '../ports/department-integrity-anchor.port';
import { DepartmentValidator } from '../services/department.validator';

/**
 * Creates a department, optionally assigns a manager, then anchors the change.
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
    if (dto.canReceiveOrders && !['LABORATORY', 'IMAGING'].includes(dto.type)) {
      throw new BadRequestException('Chỉ phòng xét nghiệm hoặc chẩn đoán hình ảnh được phép nhận chỉ định cận lâm sàng.');
    }
    if (dto.managerId) {
      const manager = await this.validator.assertStaffExists(dto.managerId);
      await this.validator.assertManagerAvailable(dto.managerId);
      this.validator.assertManagerUnassignedForCreate(manager);
    }

    const department = await this.repo.createWithManager(
      {
        departmentCode: dto.departmentCode,
        name: dto.name,
        floor: dto.floor,
        status: dto.status || OperationalStatus.ACTIVE,
        type: dto.type,
        canReceiveOrders: dto.canReceiveOrders,
        description: dto.description,
        managerId: dto.managerId || null,
      },
      (created, tx) => this.integrity.anchorChange(created, 'CREATE', actorId, null, tx),
    );
    return this.repo.findByIdOrThrow(department.id);
  }
}
