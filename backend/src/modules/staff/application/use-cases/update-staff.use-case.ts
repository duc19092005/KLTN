import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, UserRole } from '@prisma/client';
import { UpdateStaffDto } from '../../dto/staff.dto';
import { STAFF_REPOSITORY, StaffRepositoryPort } from '../ports/staff.repository.port';
import { STAFF_INTEGRITY_ANCHOR, StaffIntegrityAnchorPort } from '../ports/staff-integrity-anchor.port';
import { StaffValidator } from '../services/staff.validator';
import { buildStaffSnapshot } from '../../domain/staff-snapshot';
import { DOCTOR_REANCHOR, DoctorReanchorPort } from '../../../doctor/application/ports/doctor-reanchor.port';
import { AuditLoggerService } from '../../../../infrastructure/audit/audit-logger.service';
import { buildUnifiedDoctorSnapshot } from '../../../doctor/domain/doctor-snapshot';

/**
 * Updates a staff profile + linked user account. Behavior copied verbatim from
 * the former StaffService.update(). If the staff is a doctor, re-anchoring is
 * delegated to the narrow DoctorReanchorPort (no forwardRef to DoctorService);
 * otherwise the staff profile is anchored directly.
 */
@Injectable()
export class UpdateStaffUseCase {
  constructor(
    @Inject(STAFF_REPOSITORY) private readonly repo: StaffRepositoryPort,
    @Inject(STAFF_INTEGRITY_ANCHOR) private readonly integrity: StaffIntegrityAnchorPort,
    @Inject(DOCTOR_REANCHOR) private readonly doctorReanchor: DoctorReanchorPort,
    private readonly validator: StaffValidator,
    private readonly audit: AuditLoggerService,
  ) {}

  async execute(id: string, dto: UpdateStaffDto, actorId?: string) {
    const unsafeDto = dto as UpdateStaffDto & { username?: string; role?: UserRole; status?: string };
    if (unsafeDto.username || unsafeDto.role || unsafeDto.status) {
      throw new BadRequestException('Không được sửa tên đăng nhập, vai trò hoặc trạng thái trong chức năng cập nhật hồ sơ nhân sự.');
    }
    const staff = await this.validator.ensureStaff(id);
    if (dto.departmentId) {
      const dept = await this.repo.findDepartment(dto.departmentId);
      if (!dept) throw new NotFoundException('Không tìm thấy phòng ban.');
      if (staff.doctorProfile) {
        if (dept.type !== 'EXAMINATION' && dept.type !== 'CLINICAL') {
          throw new BadRequestException('Bác sĩ chỉ có thể được gán vào phòng khám hoặc lâm sàng.');
        }
      } else {
        await this.validator.assertDepartmentRoleCompatible(staff.user.role as UserRole, dto.departmentId);
      }
    }
    if (dto.email) await this.validator.assertUserUnique(undefined, dto.email, staff.userId);
    if (dto.citizenId) await this.validator.assertCitizenIdUnique(dto.citizenId, staff.id);
    if (dto.phone) await this.validator.assertPhoneUnique(dto.phone, staff.id);

    const before = buildStaffSnapshot(staff);
    const isDoctor = Boolean(staff.doctorProfile);
    const doctorBefore = isDoctor ? buildUnifiedDoctorSnapshot(staff.doctorProfile) : null;

    try {
      const updated = await this.repo.updateStaffUser(
        staff.userId,
        {
          email: dto.email,
          fullName: dto.fullName,
          phone: dto.phone,
          gender: dto.gender,
          citizenId: dto.citizenId,
          birthDate: dto.birthDate,
          address: dto.address,
          avatarUrl: dto.avatarUrl,
          departmentId: dto.departmentId,
          position: dto.position,
        },
        async (updatedUser, tx) => {
          if (!isDoctor && updatedUser.staffProfile) {
            await this.audit.recordV2(
              {
                entity: 'StaffProfile',
                entityId: updatedUser.staffProfile.id,
                action: 'UPDATE',
                actorId: actorId ?? null,
                before,
                after: buildStaffSnapshot(updatedUser.staffProfile),
                metadata: { source: 'staff.update' },
              },
              tx,
            );
          }
        },
      );

      if (isDoctor) {
        // Staff is a doctor → re-anchor the unified doctor hash (staff + doctor)
        await this.doctorReanchor.reanchorForStaffUpdate(id, actorId, doctorBefore);
      } else if (updated.staffProfile) {
        // Regular staff → anchor just the staff profile
        await this.integrity.anchorChange(updated.staffProfile, 'UPDATE', actorId, before);
      }

      return updated;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Thông tin nhân sự bị trùng khi lưu.');
      }
      throw error;
    }
  }
}
