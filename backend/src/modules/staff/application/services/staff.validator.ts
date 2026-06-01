import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { STAFF_REPOSITORY, StaffRepositoryPort } from '../ports/staff.repository.port';

/**
 * Shared staff validation rules, extracted verbatim from the former
 * StaffService private helpers (assertUserUnique, assertCitizenIdUnique,
 * assertEmployeeCodeUnique, ensureDepartment, ensureStaff).
 */
@Injectable()
export class StaffValidator {
  constructor(@Inject(STAFF_REPOSITORY) private readonly repo: StaffRepositoryPort) {}

  async ensureStaff(id: string): Promise<any> {
    const staff = await this.repo.findByIdWithUserDoctor(id);
    if (!staff) throw new NotFoundException('Staff profile not found');
    return staff;
  }

  async ensureDepartment(id: string): Promise<void> {
    if (!(await this.repo.departmentExists(id))) throw new NotFoundException('Department not found');
  }

  async assertUserUnique(username?: string, email?: string, excludeUserId?: string): Promise<void> {
    if (!username && !email) return;
    const existing = await this.repo.findUserByUsernameOrEmail(username, email);
    if (existing && existing.id !== excludeUserId) {
      throw new ConflictException('Username or email already exists');
    }
  }

  async assertCitizenIdUnique(citizenId: string, excludeStaffId?: string): Promise<void> {
    const existing = await this.repo.findStaffByCitizenId(citizenId);
    if (existing && existing.id !== excludeStaffId) {
      throw new ConflictException('Citizen ID already exists');
    }
  }

  async assertEmployeeCodeUnique(employeeCode: string): Promise<void> {
    const existing = await this.repo.findStaffByEmployeeCode(employeeCode);
    if (existing) throw new ConflictException('Employee code already exists');
  }
}
