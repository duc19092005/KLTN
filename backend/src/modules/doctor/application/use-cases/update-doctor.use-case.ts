import { ConflictException, Inject, Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { UpdateDoctorDto } from '../../dto/doctor.dto';
import { DOCTOR_REPOSITORY, DoctorRepositoryPort } from '../ports/doctor.repository.port';
import { DOCTOR_INTEGRITY_ANCHOR, DoctorIntegrityAnchorPort } from '../ports/doctor-integrity-anchor.port';
import { buildUnifiedDoctorSnapshot } from '../../domain/doctor-snapshot';
import { EntityRecoveryService } from '../../../../infrastructure/audit/entity-recovery.service';

/**
 * Updates a doctor (+ nested staff, + clinical room) then unified-anchors with
 * a before-snapshot. Behavior copied verbatim from the former DoctorService.update().
 */
@Injectable()
export class UpdateDoctorUseCase {
  constructor(
    @Inject(DOCTOR_REPOSITORY) private readonly repo: DoctorRepositoryPort,
    @Inject(DOCTOR_INTEGRITY_ANCHOR) private readonly integrity: DoctorIntegrityAnchorPort,
    private readonly entityRecovery: EntityRecoveryService,
  ) {}

  async execute(id: string, dto: UpdateDoctorDto, actorId?: string) {
    const existing = await this.repo.findByIdWithRelations(id);
    if (!existing) throw new NotFoundException('Không tìm thấy hồ sơ bác sĩ.');
    await this.entityRecovery.assertTrusted('DoctorProfile', id);

    if (dto.licenseNumber) {
      const license = await this.repo.findDoctorByLicense(dto.licenseNumber);
      if (license && license.id !== id) throw new ConflictException('Số Giấy phép / Chứng chỉ hành nghề này đã được đăng ký trên hệ thống.');
    }
    if (dto.citizenId) {
      const existingStaff = await this.repo.findStaffByCitizenId(dto.citizenId);
      if (existingStaff && existingStaff.id !== existing.staffProfileId) {
        throw new ConflictException('CCCD/CMND đã tồn tại.');
      }
    }
    const targetDepartmentId = dto.departmentId !== undefined ? dto.departmentId : existing.staffProfile?.departmentId;

    if (targetDepartmentId) {
      const dept = await this.repo.findDepartment(targetDepartmentId);
      if (!dept) {
        throw new NotFoundException('Không tìm thấy phòng ban.');
      }
      if (dept.type !== 'EXAMINATION' && dept.type !== 'CLINICAL') {
        throw new BadRequestException('Bác sĩ chỉ có thể được gán vào phòng khám hoặc lâm sàng.');
      }
    }

    const before = buildUnifiedDoctorSnapshot(existing);
    const doctor = await this.repo.updateWithRoom(
      id,
      dto,
      (updated, tx) => this.integrity.anchorChange(updated, 'UPDATE', actorId, before, tx),
    );
    return doctor;
  }
}
