import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CreateDoctorDto } from '../../dto/doctor.dto';
import { DOCTOR_REPOSITORY, DoctorRepositoryPort } from '../ports/doctor.repository.port';
import { DOCTOR_INTEGRITY_ANCHOR, DoctorIntegrityAnchorPort } from '../ports/doctor-integrity-anchor.port';

/**
 * Creates a DoctorProfile for an existing DOCTOR-role staff. Behavior copied
 * verbatim from the former DoctorService.create().
 */
@Injectable()
export class CreateDoctorUseCase {
  constructor(
    @Inject(DOCTOR_REPOSITORY) private readonly repo: DoctorRepositoryPort,
    @Inject(DOCTOR_INTEGRITY_ANCHOR) private readonly integrity: DoctorIntegrityAnchorPort,
  ) {}

  async execute(dto: CreateDoctorDto) {
    const staff = await this.repo.findStaffForDoctorCreate(dto.staffProfileId);
    if (!staff) throw new NotFoundException('Không tìm thấy hồ sơ nhân sự.');
    if (staff.userRole !== UserRole.DOCTOR) throw new BadRequestException('Nhân sự phải có vai trò bác sĩ.');
    if (staff.hasDoctorProfile) throw new ConflictException('Nhân sự này đã có hồ sơ bác sĩ.');

    if (staff.departmentId) {
      const dept = await this.repo.findDepartment(staff.departmentId);
      if (dept) {
        if (dept.type !== 'EXAMINATION' && dept.type !== 'CLINICAL') {
          throw new BadRequestException('Bác sĩ chỉ có thể được gán vào phòng khám hoặc lâm sàng.');
        }
      }
    }

    const license = await this.repo.findDoctorByLicense(dto.licenseNumber);
    if (license) throw new ConflictException('Số chứng chỉ hành nghề đã tồn tại.');

    const doctor = await this.repo.createForExistingStaff(dto);
    await this.integrity.anchorChange(doctor, 'CREATE', undefined, null);
    return doctor;
  }
}
