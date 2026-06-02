import { ConflictException, Inject, Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { UpdateDoctorDto } from '../../dto/doctor.dto';
import { DOCTOR_REPOSITORY, DoctorRepositoryPort } from '../ports/doctor.repository.port';
import { DOCTOR_INTEGRITY_ANCHOR, DoctorIntegrityAnchorPort } from '../ports/doctor-integrity-anchor.port';
import { buildUnifiedDoctorSnapshot } from '../../domain/doctor-snapshot';

/**
 * Updates a doctor (+ nested staff, + clinical room) then unified-anchors with
 * a before-snapshot. Behavior copied verbatim from the former DoctorService.update().
 */
@Injectable()
export class UpdateDoctorUseCase {
  constructor(
    @Inject(DOCTOR_REPOSITORY) private readonly repo: DoctorRepositoryPort,
    @Inject(DOCTOR_INTEGRITY_ANCHOR) private readonly integrity: DoctorIntegrityAnchorPort,
  ) {}

  async execute(id: string, dto: UpdateDoctorDto, actorId?: string) {
    const existing = await this.repo.findByIdWithRelations(id);
    if (!existing) throw new NotFoundException('Doctor profile not found');

    if (dto.licenseNumber) {
      const license = await this.repo.findDoctorByLicense(dto.licenseNumber);
      if (license && license.id !== id) throw new ConflictException('License number already exists');
    }
    if (dto.citizenId) {
      const existingStaff = await this.repo.findStaffByCitizenId(dto.citizenId);
      if (existingStaff && existingStaff.id !== existing.staffProfileId) {
        throw new ConflictException('Citizen ID already exists');
      }
    }
    const targetSpecialty = dto.specialty !== undefined ? dto.specialty : existing.specialty;
    const targetDepartmentId = dto.departmentId !== undefined ? dto.departmentId : existing.staffProfile?.departmentId;

    if (targetDepartmentId) {
      const dept = await this.repo.findDepartment(targetDepartmentId);
      if (!dept) {
        throw new NotFoundException('Department not found');
      }
      if (dept.type !== 'CLINICAL') {
        throw new BadRequestException('Doctor can only be assigned to a CLINICAL department');
      }
      if (dept.specialty && dept.specialty !== targetSpecialty) {
        throw new BadRequestException(`Bác sĩ chuyên khoa "${targetSpecialty}" không thể được xếp vào phòng ban chuyên khoa "${dept.specialty}"`);
      }
    }

    const before = buildUnifiedDoctorSnapshot(existing);
    const doctor = await this.repo.updateWithRoom(id, dto);
    await this.integrity.anchorChange(doctor, 'UPDATE', actorId, before);
    return doctor;
  }
}
