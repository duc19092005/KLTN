import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { STAFF_REPOSITORY, StaffRepositoryPort } from '../ports/staff.repository.port';

/**
 * Shared staff validation rules, extracted verbatim from the former
 * StaffService private helpers (assertUserUnique, assertCitizenIdUnique,
 * assertEmployeeCodeUnique, ensureDepartment, ensureStaff), plus a
 * department-role compatibility check so a receptionist cannot be filed
 * under a clinical room (and vice versa).
 */
@Injectable()
export class StaffValidator {
  constructor(@Inject(STAFF_REPOSITORY) private readonly repo: StaffRepositoryPort) {}

  async ensureStaff(id: string): Promise<any> {
    const staff = await this.repo.findByIdWithUserDoctor(id);
    if (!staff) throw new NotFoundException('Không tìm thấy hồ sơ nhân sự.');
    return staff;
  }

  async ensureDepartment(id: string): Promise<void> {
    if (!(await this.repo.departmentExists(id))) throw new NotFoundException('Không tìm thấy phòng ban.');
  }

  /**
   * Cross-check that the staff's role is compatible with the department type:
   *  - RECEPTIONIST  → ADMINISTRATIVE only
   *  - DOCTOR        → EXAMINATION only
   *  - LAB_MANAGER   → LABORATORY | IMAGING | PHARMACY
   *  - ADMIN         → no department restriction
   * Throws BadRequestException with a Vietnamese message that the UI surfaces directly.
   */
  async assertDepartmentRoleCompatible(role: UserRole, departmentId: string | null | undefined): Promise<void> {
    if (!departmentId) return; // departmentId is optional
    const dept = await this.repo.findDepartment(departmentId);
    if (!dept) throw new NotFoundException('Không tìm thấy phòng ban.');

    const map: Record<string, string[]> = {
      RECEPTIONIST: ['ADMINISTRATIVE'],
      DOCTOR: ['EXAMINATION', 'CLINICAL'],
      LAB_MANAGER: ['LABORATORY', 'IMAGING', 'PHARMACY'],
      ADMIN: [],
    };
    const allowed = map[role] || [];
    if (allowed.length === 0) return; // ADMIN: skip
    if (!allowed.includes(dept.type)) {
      const human: Record<UserRole, string> = {
        RECEPTIONIST: 'Lễ tân chỉ thuộc phòng ban hành chính.',
        DOCTOR: 'Bác sĩ chỉ thuộc phòng khám.',
        LAB_MANAGER: 'Kỹ thuật viên cận lâm sàng chỉ thuộc khoa xét nghiệm, chẩn đoán hình ảnh hoặc dược.',
        ADMIN: '',
      } as Record<UserRole, string>;
      throw new BadRequestException(human[role] || 'Vai trò không phù hợp với loại phòng ban.');
    }
  }

  async assertUserUnique(username?: string, email?: string, excludeUserId?: string): Promise<void> {
    if (!username && !email) return;
    const existing = await this.repo.findUserByUsernameOrEmail(username, email);
    if (existing && existing.id !== excludeUserId) {
      throw new ConflictException('Tên đăng nhập hoặc email đã tồn tại.');
    }
  }

  async assertCitizenIdUnique(citizenId: string, excludeStaffId?: string): Promise<void> {
    const existing = await this.repo.findStaffByCitizenId(citizenId);
    if (existing && existing.id !== excludeStaffId) {
      throw new ConflictException('CCCD/CMND đã tồn tại.');
    }
  }

  async assertEmployeeCodeUnique(employeeCode: string): Promise<void> {
    const existing = await this.repo.findStaffByEmployeeCode(employeeCode);
    if (existing) throw new ConflictException('Mã nhân viên đã tồn tại.');
  }
}
