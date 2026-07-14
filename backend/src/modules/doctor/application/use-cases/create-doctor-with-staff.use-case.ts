import * as bcrypt from 'bcrypt';
import { ConflictException, Inject, Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CreateDoctorWithStaffDto } from '../../dto/doctor.dto';
import { DOCTOR_REPOSITORY, DoctorRepositoryPort } from '../ports/doctor.repository.port';
import { DOCTOR_INTEGRITY_ANCHOR, DoctorIntegrityAnchorPort } from '../ports/doctor-integrity-anchor.port';
import { generateTemporaryPassword } from '../../../../common/security/temporary-password';
import { TEMPORARY_CREDENTIAL_MAILER } from '../../../../infrastructure/email/email.constants';
import { TemporaryCredentialMailerPort } from '../../../../infrastructure/email/email.types';

/**
 * Creates a doctor user + staff profile + doctor profile in one transaction,
 * then anchors the unified staff+doctor snapshot.
 */
@Injectable()
export class CreateDoctorWithStaffUseCase {
  constructor(
    @Inject(DOCTOR_REPOSITORY) private readonly repo: DoctorRepositoryPort,
    @Inject(DOCTOR_INTEGRITY_ANCHOR) private readonly integrity: DoctorIntegrityAnchorPort,
    @Inject(TEMPORARY_CREDENTIAL_MAILER) private readonly mailer: TemporaryCredentialMailerPort,
  ) {}

  async execute(dto: CreateDoctorWithStaffDto, actorId?: string) {
    if (!dto.departmentId) {
      throw new BadRequestException('Vui lòng chọn phòng ban khám cho bác sĩ.');
    }

    const dept = await this.repo.findDepartment(dto.departmentId);
    if (!dept) throw new NotFoundException('Không tìm thấy phòng ban.');
    if (dept.type !== 'EXAMINATION' && dept.type !== 'CLINICAL') {
      throw new BadRequestException('Bác sĩ chỉ có thể được gán vào phòng khám hoặc lâm sàng.');
    }

    if (await this.repo.findUserByUsernameOrEmail(dto.username, dto.email)) {
      throw new ConflictException('Tên đăng nhập hoặc email đã tồn tại.');
    }
    if (await this.repo.findStaffByCitizenId(dto.citizenId)) {
      throw new ConflictException('CCCD/CMND đã tồn tại.');
    }
    if (await this.repo.findDoctorByLicense(dto.licenseNumber)) {
      throw new ConflictException('Số Giấy phép / Chứng chỉ hành nghề này đã được đăng ký trên hệ thống.');
    }

    const employeeCode = await this.repo.generateEmployeeCode();
    if (await this.repo.findStaffByEmployeeCode(employeeCode)) {
      throw new ConflictException('Mã nhân viên đã tồn tại.');
    }
    const temporaryPassword = generateTemporaryPassword();
    const passwordHash = await bcrypt.hash(temporaryPassword, 12);

    try {
      const doctor = await this.repo.createWithStaff(
        dto,
        employeeCode,
        passwordHash,
        async (created, tx) => {
          await this.integrity.anchorChange(created, 'CREATE', actorId, null, tx);
          await this.mailer.sendTemporaryPassword({
            to: dto.email.trim().toLowerCase(),
            fullName: dto.fullName.trim(),
            username: dto.username.trim(),
            temporaryPassword,
          });
        },
      );
      return doctor;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Thông tin bác sĩ bị trùng khi lưu.');
      }
      throw error;
    }
  }
}
