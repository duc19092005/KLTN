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
    if (!staff) throw new NotFoundException('Staff profile not found');
    if (staff.userRole !== UserRole.DOCTOR) throw new BadRequestException('Staff user role must be DOCTOR');
    if (staff.hasDoctorProfile) throw new ConflictException('Doctor profile already exists for this staff');

    const license = await this.repo.findDoctorByLicense(dto.licenseNumber);
    if (license) throw new ConflictException('License number already exists');

    const doctor = await this.repo.createForExistingStaff(dto);
    await this.integrity.anchorChange(doctor, 'CREATE', undefined, null);
    return doctor;
  }
}
