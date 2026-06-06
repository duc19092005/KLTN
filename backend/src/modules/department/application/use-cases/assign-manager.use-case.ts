import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { AssignManagerDto } from '../../dto/department.dto';
import { DEPARTMENT_REPOSITORY, DepartmentRepositoryPort } from '../ports/department.repository.port';
import { DepartmentValidator } from '../services/department.validator';

/**
 * Assigns or clears a department manager. Behavior copied verbatim from the
 * former DepartmentService.assignManager(). Note: this endpoint does not anchor
 * an integrity change (matching previous behavior).
 */
@Injectable()
export class AssignManagerUseCase {
  constructor(
    @Inject(DEPARTMENT_REPOSITORY) private readonly repo: DepartmentRepositoryPort,
    private readonly validator: DepartmentValidator,
  ) {}

  async execute(id: string, dto: AssignManagerDto, _actorId?: string) {
    await this.validator.ensureDepartment(id);
    if (dto.managerId) {
      const staff = await this.validator.assertStaffExists(dto.managerId);
      await this.validator.assertManagerAvailable(dto.managerId, id);
      if (staff.departmentId && staff.departmentId !== id) {
        throw new BadRequestException('Trưởng phòng ban phải thuộc phòng ban này hoặc chưa được gán phòng ban.');
      }
      if (!staff.departmentId) await this.repo.setStaffDepartment(staff.id, id);
    }
    return this.repo.assignManager(id, dto.managerId || null);
  }
}
