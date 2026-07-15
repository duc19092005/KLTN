import { BadRequestException, Inject, Injectable, ConflictException } from '@nestjs/common';
import { Prisma, UserRole } from '@prisma/client';
import { CreateStaffDto } from '../../dto/staff.dto';
import { STAFF_REPOSITORY, StaffRepositoryPort } from '../ports/staff.repository.port';
import { STAFF_INTEGRITY_ANCHOR, StaffIntegrityAnchorPort } from '../ports/staff-integrity-anchor.port';
import { PASSWORD_HASHER, PasswordHasherPort } from '../ports/password-hasher.port';
import { StaffValidator } from '../services/staff.validator';
import { generateTemporaryPassword } from '../../../../common/security/temporary-password';
import { TEMPORARY_CREDENTIAL_MAILER } from '../../../../infrastructure/email/email.constants';
import { TemporaryCredentialMailerPort } from '../../../../infrastructure/email/email.types';

/**
 * Creates a (non-doctor) staff profile + login user, then anchors the staff
 * profile on-chain. Behavior copied verbatim from the former StaffService.create():
 * blocks ADMIN/DOCTOR roles, validates uniqueness, generates employee code,
 * hashes the default password, creates atomically, then anchors.
 */
@Injectable()
export class CreateStaffUseCase {
  constructor(
    @Inject(STAFF_REPOSITORY) private readonly repo: StaffRepositoryPort,
    @Inject(STAFF_INTEGRITY_ANCHOR) private readonly integrity: StaffIntegrityAnchorPort,
    @Inject(PASSWORD_HASHER) private readonly passwordHasher: PasswordHasherPort,
    @Inject(TEMPORARY_CREDENTIAL_MAILER) private readonly mailer: TemporaryCredentialMailerPort,
    private readonly validator: StaffValidator,
  ) {}

  async execute(dto: CreateStaffDto, actorId?: string) {
    if (dto.role === UserRole.ADMIN) {
      throw new BadRequestException('Không thể tạo tài khoản quản trị từ module nhân sự.');
    }
    if (dto.role === UserRole.DOCTOR) {
      throw new BadRequestException('Vui lòng tạo bác sĩ tại module bác sĩ để có đầy đủ hồ sơ chuyên môn.');
    }
    if (dto.departmentId) {
      await this.validator.ensureDepartment(dto.departmentId);
      await this.validator.assertDepartmentRoleCompatible(dto.role, dto.departmentId);
    }
    await this.validator.assertUserUnique(dto.username, dto.email);
    await this.validator.assertCitizenIdUnique(dto.citizenId);
    await this.validator.assertPhoneUnique(dto.phone);
    const employeeCode = dto.employeeCode || (await this.repo.generateEmployeeCode(dto.role));
    await this.validator.assertEmployeeCodeUnique(employeeCode);
    const temporaryPassword = generateTemporaryPassword();
    const passwordHash = await this.passwordHasher.hash(temporaryPassword);

    try {
      const user = await this.repo.createStaffUser(
        {
          username: dto.username,
          email: dto.email,
          passwordHash,
          role: dto.role,
          employeeCode,
          fullName: dto.fullName,
          phone: dto.phone,
          gender: dto.gender,
          citizenId: dto.citizenId,
          birthDate: dto.birthDate,
          address: dto.address,
          avatarUrl: dto.avatarUrl,
          departmentId: dto.departmentId || null,
          position: dto.position,
        },
        async (created, tx) => {
          if (created.staffProfile) {
            created.staffProfile.user = created;
            await this.integrity.anchorChange(created.staffProfile, 'CREATE', actorId, null, tx);
          }
          await this.mailer.sendTemporaryPassword({
            to: dto.email.trim().toLowerCase(),
            fullName: dto.fullName.trim(),
            username: dto.username.trim(),
            temporaryPassword,
          });
        },
      );

      return user;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Thông tin nhân sự bị trùng khi lưu.');
      }
      throw error;
    }
  }
}
