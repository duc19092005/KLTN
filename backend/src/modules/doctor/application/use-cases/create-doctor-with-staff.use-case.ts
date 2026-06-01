import * as bcrypt from 'bcrypt';
import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CreateDoctorWithStaffDto } from '../../dto/doctor.dto';
import { DOCTOR_REPOSITORY, DoctorRepositoryPort } from '../ports/doctor.repository.port';
import { DOCTOR_INTEGRITY_ANCHOR, DoctorIntegrityAnchorPort } from '../ports/doctor-integrity-anchor.port';

const DEFAULT_STAFF_PASSWORD = '123456';

/**
 * Creates a doctor user + staff profile + doctor profile (+ optional room) in
 * one transaction, then unified-anchors. Behavior copied verbatim from the
 * former DoctorService.createWithStaff().
 */
@Injectable()
export class CreateDoctorWithStaffUseCase {
  constructor(
    @Inject(DOCTOR_REPOSITORY) private readonly repo: DoctorRepositoryPort,
    @Inject(DOCTOR_INTEGRITY_ANCHOR) private readonly integrity: DoctorIntegrityAnchorPort,
  ) {}

  async execute(dto: CreateDoctorWithStaffDto) {
    if (dto.departmentId && !(await this.repo.departmentExists(dto.departmentId))) {
      throw new NotFoundException('Department not found');
    }
    if (dto.clinicalRoomId && !(await this.repo.roomExists(dto.clinicalRoomId))) {
      throw new NotFoundException('Clinical room not found');
    }
    if (await this.repo.findUserByUsernameOrEmail(dto.username, dto.email)) {
      throw new ConflictException('Username or email already exists');
    }
    if (await this.repo.findStaffByCitizenId(dto.citizenId)) {
      throw new ConflictException('Citizen ID already exists');
    }
    if (await this.repo.findDoctorByLicense(dto.licenseNumber)) {
      throw new ConflictException('License number already exists');
    }

    const employeeCode = await this.repo.generateEmployeeCode();
    if (await this.repo.findStaffByEmployeeCode(employeeCode)) {
      throw new ConflictException('Employee code already exists');
    }
    const passwordHash = await bcrypt.hash(DEFAULT_STAFF_PASSWORD, 12);

    try {
      const doctor = await this.repo.createWithStaff(dto, employeeCode, passwordHash);
      // Single unified anchor: staff + doctor data hashed together under doctor.id
      await this.integrity.anchorChange(doctor, 'CREATE', undefined, null);
      return doctor;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Unique constraint violation while saving doctor');
      }
      throw error;
    }
  }
}
