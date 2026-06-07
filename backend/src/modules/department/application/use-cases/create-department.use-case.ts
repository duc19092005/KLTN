import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { OperationalStatus, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { CreateDepartmentDto } from '../../dto/department.dto';
import { DEPARTMENT_REPOSITORY, DepartmentRepositoryPort } from '../ports/department.repository.port';
import { DEPARTMENT_INTEGRITY_ANCHOR, DepartmentIntegrityAnchorPort } from '../ports/department-integrity-anchor.port';
import { DepartmentValidator } from '../services/department.validator';

/**
 * Creates a department, auto-provisions a DEPT_SHARED shared account for
 * paraclinical login, optionally assigns a manager, then anchors the change.
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
        CLINICAL: ['DOCTOR'],
        LABORATORY: ['LAB_MANAGER'],
        IMAGING: ['LAB_MANAGER'],
        PHARMACY: ['LAB_MANAGER'],
      };
      const wantedType = (dto.type as unknown as string) || 'CLINICAL';
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

    // Build shared user data for the department
    const sharedUsername = this.buildSharedUsername(dto.departmentCode);
    const sharedEmail = `${sharedUsername}@hospital.local`;
    const defaultPassword = '123456';
    const passwordHash = await bcrypt.hash(defaultPassword, 10);

    const department = await this.repo.createWithManager(
      {
        departmentCode: dto.departmentCode,
        name: dto.name,
        floor: dto.floor,
        status: dto.status || OperationalStatus.ACTIVE,
        type: dto.type,
        canReceiveOrders: dto.canReceiveOrders ?? false,
        description: dto.description,
        managerId: dto.managerId || null,
        specialty: dto.specialty || null,
      },
      {
        username: sharedUsername,
        email: sharedEmail,
        passwordHash,
        role: UserRole.DEPT_SHARED,
      },
    );

    await this.integrity.anchorChange(department, 'CREATE', actorId, null);
    return department;
  }

  /**
   * Derive a shared username from the department code.
   * Example: "PB-XRAY" → "dept_xray", "PB-CT" → "dept_ct"
   */
  private buildSharedUsername(departmentCode: string): string {
    const cleaned = departmentCode
      .replace(/^PB-/i, '') // Remove common prefix
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '_') // Replace non-alphanumeric with underscore
      .replace(/_+/g, '_') // Collapse multiple underscores
      .replace(/^_|_$/g, ''); // Trim leading/trailing underscores
    return `dept_${cleaned || 'shared'}`;
  }
}
