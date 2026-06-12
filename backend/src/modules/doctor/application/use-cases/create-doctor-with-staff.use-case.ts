import * as bcrypt from 'bcrypt';
import { ConflictException, Inject, Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CreateDoctorWithStaffDto } from '../../dto/doctor.dto';
import { DOCTOR_REPOSITORY, DoctorRepositoryPort } from '../ports/doctor.repository.port';
import { DOCTOR_INTEGRITY_ANCHOR, DoctorIntegrityAnchorPort } from '../ports/doctor-integrity-anchor.port';

const DEFAULT_STAFF_PASSWORD = '123456';

/**
 * Creates a doctor user + staff profile + doctor profile in one transaction,
 * then anchors the unified staff+doctor snapshot.
 */
@Injectable()
export class CreateDoctorWithStaffUseCase {
  constructor(
    @Inject(DOCTOR_REPOSITORY) private readonly repo: DoctorRepositoryPort,
    @Inject(DOCTOR_INTEGRITY_ANCHOR) private readonly integrity: DoctorIntegrityAnchorPort,
  ) {}

  async execute(dto: CreateDoctorWithStaffDto) {
    if (!dto.departmentId) {
      throw new BadRequestException('Vui lòng chọn phòng ban khám cho bác sĩ.');
    }

    const dept = await this.repo.findDepartment(dto.departmentId);
    if (!dept) throw new NotFoundException('Không tìm thấy phòng ban.');
    if (dept.type !== 'EXAMINATION' && dept.type !== 'CLINICAL') {
      throw new BadRequestException('Bác sĩ chỉ có thể được gán vào phòng khám hoặc lâm sàng.');
    }
    if (dept.specialty && dept.specialty !== dto.specialty) {
      throw new BadRequestException(`Bác sĩ chuyên khoa "${dto.specialty}" không thể được xếp vào phòng ban chuyên khoa "${dept.specialty}"`);
    }

    if (await this.repo.findUserByUsernameOrEmail(dto.username, dto.email)) {
      throw new ConflictException('Tên đăng nhập hoặc email đã tồn tại.');
    }
    if (await this.repo.findStaffByCitizenId(dto.citizenId)) {
      throw new ConflictException('CCCD/CMND đã tồn tại.');
    }
    if (await this.repo.findDoctorByLicense(dto.licenseNumber)) {
      throw new ConflictException('Số chứng chỉ hành nghề đã tồn tại.');
    }

    const employeeCode = await this.repo.generateEmployeeCode();
    if (await this.repo.findStaffByEmployeeCode(employeeCode)) {
      throw new ConflictException('Mã nhân viên đã tồn tại.');
    }
    const passwordHash = await bcrypt.hash(DEFAULT_STAFF_PASSWORD, 12);

    try {
      const doctor = await this.repo.createWithStaff(dto, employeeCode, passwordHash);
      await this.integrity.anchorChange(doctor, 'CREATE', undefined, null);
      return doctor;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Thông tin bác sĩ bị trùng khi lưu.');
      }
      throw error;
    }
  }
}
