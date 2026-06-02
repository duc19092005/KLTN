import { Inject, Injectable, BadRequestException } from '@nestjs/common';
import { UpdateDepartmentDto } from '../../dto/department.dto';
import { DEPARTMENT_REPOSITORY, DepartmentRepositoryPort } from '../ports/department.repository.port';
import { DEPARTMENT_INTEGRITY_ANCHOR, DepartmentIntegrityAnchorPort } from '../ports/department-integrity-anchor.port';
import { DepartmentValidator } from '../services/department.validator';
import { buildDepartmentSnapshot } from '../../domain/department-snapshot';

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
  ) {}

  async execute(id: string, dto: UpdateDepartmentDto, actorId?: string) {
    const existing = await this.repo.findByIdOrThrow(id);
    if (dto.name) await this.validator.assertNameUnique(dto.name, id);
    if (dto.departmentCode) await this.validator.assertDepartmentCodeUnique(dto.departmentCode, id);
    if (dto.type && dto.type !== 'CLINICAL') {
      const hasDoctors = existing.staffs?.some((staff: any) => staff.doctorProfile !== null);
      if (hasDoctors) {
        throw new BadRequestException('Cannot change department type to non-CLINICAL because it has doctors assigned to it');
      }
    }
    const before = buildDepartmentSnapshot(existing);
    const targetType = dto.type || existing.type;
    const specialtyValue = (targetType === 'CLINICAL' || targetType === 'LABORATORY')
      ? (dto.specialty !== undefined ? dto.specialty : existing.specialty)
      : null;

    const department = await this.repo.update(id, {
      departmentCode: dto.departmentCode,
      name: dto.name,
      floor: dto.floor,
      status: dto.status,
      type: dto.type,
      canReceiveOrders: dto.canReceiveOrders,
      description: dto.description,
      specialty: specialtyValue,
    });

    await this.integrity.anchorChange(department, 'UPDATE', actorId, before);
    return department;
  }
}
