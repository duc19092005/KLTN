import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  DEPARTMENT_REPOSITORY,
  DepartmentRepositoryPort,
  StaffProfileInfo,
} from '../ports/department.repository.port';

/**
 * Shared department validation rules, extracted verbatim from the former
 * DepartmentService private helpers (assertNameUnique, assertDepartmentCodeUnique,
 * assertStaffExists, assertManagerAvailable). Reused by create/update/assignManager.
 */
@Injectable()
export class DepartmentValidator {
  constructor(@Inject(DEPARTMENT_REPOSITORY) private readonly repo: DepartmentRepositoryPort) {}

  async ensureDepartment(id: string): Promise<any> {
    const department = await this.repo.findById(id);
    if (!department) throw new NotFoundException('Không tìm thấy phòng ban.');
    return department;
  }

  async assertStaffExists(id: string): Promise<StaffProfileInfo> {
    const staff = await this.repo.findStaffById(id);
    if (!staff) throw new NotFoundException('Không tìm thấy hồ sơ nhân sự.');
    return staff;
  }

  async assertNameUnique(name: string, excludeId?: string): Promise<void> {
    const existing = await this.repo.findByName(name);
    if (existing && existing.id !== excludeId) throw new ConflictException('Tên phòng ban đã tồn tại.');
  }

  async assertDepartmentCodeUnique(departmentCode: string, excludeId?: string): Promise<void> {
    const existing = await this.repo.findByDepartmentCode(departmentCode);
    if (existing && existing.id !== excludeId) throw new ConflictException('Mã phòng ban đã tồn tại.');
  }

  async assertManagerAvailable(managerId: string, departmentId?: string): Promise<void> {
    const existing = await this.repo.findDepartmentByManagerId(managerId);
    if (existing && existing.id !== departmentId) throw new ConflictException('Nhân sự này đã là trưởng phòng ban khác.');
  }

  /** Used by create(): a fresh manager must not already belong to a department. */
  assertManagerUnassignedForCreate(manager: StaffProfileInfo): void {
    if (manager.departmentId) {
      throw new BadRequestException('Trưởng phòng ban đã được gán cho phòng ban khác.');
    }
  }
}
