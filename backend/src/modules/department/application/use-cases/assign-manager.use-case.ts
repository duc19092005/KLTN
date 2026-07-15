import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { AssignManagerDto } from '../../dto/department.dto';
import { DEPARTMENT_REPOSITORY, DepartmentRepositoryPort } from '../ports/department.repository.port';
import { DEPARTMENT_INTEGRITY_ANCHOR, DepartmentIntegrityAnchorPort } from '../ports/department-integrity-anchor.port';
import { DepartmentValidator } from '../services/department.validator';
import { buildDepartmentSnapshot } from '../../domain/department-snapshot';

/**
 * Assigns or clears a department manager. Captures a before-snapshot, applies the
 * change atomically (manager assignment + optional staff department auto-fill), then
 * re-anchors the new department state. Without the re-anchor the integrity check
 * would report tampering because managerId is part of the canonical snapshot.
 */
@Injectable()
export class AssignManagerUseCase {
  constructor(
    @Inject(DEPARTMENT_REPOSITORY) private readonly repo: DepartmentRepositoryPort,
    @Inject(DEPARTMENT_INTEGRITY_ANCHOR) private readonly integrity: DepartmentIntegrityAnchorPort,
    private readonly validator: DepartmentValidator,
  ) {}

  async execute(id: string, dto: AssignManagerDto, actorId?: string) {
    const department = await this.validator.ensureDepartment(id);
    if (dto.managerId) {
      const staff = await this.validator.assertStaffExists(dto.managerId);
      await this.validator.assertManagerAvailable(dto.managerId, id);

      // Belongs to (or is unassigned to) THIS department.
      if (staff.departmentId && staff.departmentId !== id) {
        throw new BadRequestException('Trưởng phòng ban phải thuộc phòng ban này hoặc chưa được gán phòng ban.');
      }

      // Role-department compatibility. The manager's user role must match the department type:
      //   ADMINISTRATIVE → RECEPTIONIST, CLINICAL → DOCTOR, LABORATORY/IMAGING → LAB_MANAGER.
      // Mirror the rules already enforced when filing a staff member into a department, so a
      // receptionist cannot accidentally become the head of a paraclinical department or vice versa.
      const role = staff.userRole;
      const allowedByType: Record<string, string[]> = {
        ADMINISTRATIVE: ['RECEPTIONIST'],
        CLINICAL: ['DOCTOR'],
        LABORATORY: ['LAB_MANAGER'],
        IMAGING: ['LAB_MANAGER'],
      };
      const allowed = allowedByType[department.type] || [];
      if (allowed.length > 0 && !allowed.includes(role || '')) {
        const human: Record<string, string> = {
          ADMINISTRATIVE: 'Phòng hành chính chỉ có thể giao cho lễ tân làm trưởng phòng.',
          CLINICAL: 'Phòng khám lâm sàng chỉ có thể giao cho bác sĩ làm trưởng phòng.',
          LABORATORY: 'Khoa xét nghiệm chỉ có thể giao cho kỹ thuật viên cận lâm sàng làm trưởng khoa.',
          IMAGING: 'Khoa chẩn đoán hình ảnh chỉ có thể giao cho kỹ thuật viên cận lâm sàng làm trưởng khoa.',
        };
        throw new BadRequestException(human[department.type] || 'Vai trò không phù hợp với loại phòng ban.');
      }

      // The repository assigns an unassigned manager inside the same transaction
      // as the department update and audit write.
    }

    // Capture the before-snapshot using the canonical fields (name/code/type/managerId/etc),
    // then apply the change and anchor the new state.
    const fullBefore = await this.repo.findByIdOrThrow(id);
    const before = buildDepartmentSnapshot(fullBefore);
    const manager = dto.managerId ? await this.validator.assertStaffExists(dto.managerId) : null;
    const updated = await this.repo.assignManager(
      id,
      dto.managerId || null,
      manager && !manager.departmentId ? manager.id : undefined,
      (departmentAfter, tx) => this.integrity.anchorChange(departmentAfter, 'UPDATE', actorId, before, tx),
    );
    return updated;
  }
}
