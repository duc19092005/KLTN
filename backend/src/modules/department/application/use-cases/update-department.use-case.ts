import { Inject, Injectable, BadRequestException } from '@nestjs/common';
import { UpdateDepartmentDto } from '../../dto/department.dto';
import { DEPARTMENT_REPOSITORY, DepartmentRepositoryPort } from '../ports/department.repository.port';
import { DEPARTMENT_INTEGRITY_ANCHOR, DepartmentIntegrityAnchorPort } from '../ports/department-integrity-anchor.port';
import { DepartmentValidator } from '../services/department.validator';
import { buildDepartmentSnapshot } from '../../domain/department-snapshot';
import { EntityRecoveryService } from '../../../../infrastructure/audit/entity-recovery.service';

/**
 * Updates a department then anchors the change (with before-snapshot).
 * Behavior copied verbatim from the former DepartmentService.update().
 */
@Injectable()
export class UpdateDepartmentUseCase {
  constructor(
    @Inject(DEPARTMENT_REPOSITORY) private readonly repo: DepartmentRepositoryPort,
    @Inject(DEPARTMENT_INTEGRITY_ANCHOR) private readonly integrity: DepartmentIntegrityAnchorPort,
    private readonly validator: DepartmentValidator,
    private readonly entityRecovery: EntityRecoveryService,
  ) {}

  async execute(id: string, dto: UpdateDepartmentDto, actorId?: string) {
    const existing = await this.repo.findByIdOrThrow(id);
    await this.entityRecovery.assertTrusted('Department', id);
    if (dto.name) await this.validator.assertNameUnique(dto.name, id);
    if (dto.departmentCode) await this.validator.assertDepartmentCodeUnique(dto.departmentCode, id);
    const structuralChange =
      (dto.departmentCode !== undefined && dto.departmentCode !== existing.departmentCode) ||
      (dto.type !== undefined && dto.type !== existing.type) ||
      (dto.canReceiveOrders !== undefined && dto.canReceiveOrders !== existing.canReceiveOrders);
    if (structuralChange && (await this.repo.countBusinessReferences(id)) > 0) {
      throw new BadRequestException('Không thể thay đổi mã, loại hoặc khả năng nhận chỉ định vì phòng ban đã có dữ liệu liên quan.');
    }

    const resultingType = dto.type ?? existing.type;
    const resultingCanReceiveOrders = dto.canReceiveOrders ?? existing.canReceiveOrders;
    if (resultingCanReceiveOrders && !['LABORATORY', 'IMAGING'].includes(resultingType)) {
      throw new BadRequestException('Chỉ phòng xét nghiệm hoặc chẩn đoán hình ảnh được phép nhận chỉ định cận lâm sàng.');
    }
    const before = buildDepartmentSnapshot(existing);

    const department = await this.repo.update(
      id,
      {
        departmentCode: dto.departmentCode,
        name: dto.name,
        floor: dto.floor,
        status: dto.status,
        type: dto.type,
        canReceiveOrders: dto.canReceiveOrders,
        description: dto.description,
      },
      (updated, tx) => this.integrity.anchorChange(updated, 'UPDATE', actorId, before, tx),
    );
    return department;
  }
}
