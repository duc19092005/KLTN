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
    if (dto.managerId) {
      const manager = await this.validator.assertStaffExists(dto.managerId);
      await this.validator.assertManagerAvailable(dto.managerId);
      this.validator.assertManagerUnassignedForCreate(manager);

      // Role-department compatibility (same rule as AssignManagerUseCase). Done in code rather
      // than in the validator so we can swap in the type the user is creating, since the dept
      // hasn't been persisted yet.
      const role = manager.userRole;
      const allowedByType: Record<string, string[]> = {
        ADMINISTRATIVE: ['RECEPTIONIST'],
        EXAMINATION: ['DOCTOR'],
        CLINICAL: ['DOCTOR'],
        LABORATORY: ['LAB_MANAGER'],
        IMAGING: ['LAB_MANAGER'],
        PHARMACY: ['LAB_MANAGER'],
      };
      const wantedType = (dto.type as unknown as string) || 'EXAMINATION';
      const allowed = allowedByType[wantedType] || [];
      if (allowed.length > 0 && role && !allowed.includes(role)) {
        const human: Record<string, string> = {
          ADMINISTRATIVE: 'Phòng hành chính chỉ có thể giao cho lễ tân làm trưởng phòng.',
          CLINICAL: 'Phòng khám lâm sàng chỉ có thể giao cho bác sĩ làm trưởng phòng.',
          LABORATORY: 'Khoa xét nghiệm chỉ có thể giao cho kỹ thuật viên cận lâm sàng làm trưởng khoa.',
          IMAGING: 'Khoa chẩn đoán hình ảnh chỉ có thể giao cho kỹ thuật viên cận lâm sàng làm trưởng khoa.',
          PHARMACY: 'Khoa dược chỉ có thể giao cho kỹ thuật viên dược/cận lâm sàng làm trưởng khoa.',
        };
        throw new BadRequestException(human[wantedType] || 'Vai trò không phù hợp với loại phòng ban.');
      }
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
      specialty: dto.specialty || null,
    });

    await this.integrity.anchorChange(department, 'CREATE', actorId, null);
    return this.repo.findByIdOrThrow(department.id);
  }
}

