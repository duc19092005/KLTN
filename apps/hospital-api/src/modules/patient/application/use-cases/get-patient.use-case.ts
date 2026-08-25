import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { UpdatePatientDto } from '../../dto/patient.dto';
import { PATIENT_REPOSITORY, PatientRepositoryPort } from '../ports/patient.repository.port';
import { PATIENT_INTEGRITY_ANCHOR, PatientIntegrityAnchorPort } from '../ports/patient-integrity-anchor.port';
import { buildPatientSnapshot } from '../../domain/patient-snapshot';
import { EntityRecoveryService } from '../../../../infrastructure/audit';

/**
 * Fetch one patient and update a patient. Behavior copied verbatim from the
 * former PatientService.findOne()/update(): update first ensures the patient
 * exists (NotFound otherwise) before applying changes.
 * After update, anchors the changed patient record for tamper-evidence.
 */
@Injectable()
export class GetPatientUseCase {
  constructor(
    @Inject(PATIENT_REPOSITORY) private readonly repo: PatientRepositoryPort,
    @Inject(PATIENT_INTEGRITY_ANCHOR) private readonly integrity: PatientIntegrityAnchorPort,
    private readonly entityRecovery: EntityRecoveryService,
  ) {}

  async findOne(id: string) {
    const patient = await this.repo.findByIdWithRelations(id);
    if (!patient) throw new NotFoundException('Không tìm thấy hồ sơ bệnh nhân.');
    return patient;
  }

  async update(id: string, dto: UpdatePatientDto, actorId?: string) {
    const existing = await this.findOne(id);
    await this.entityRecovery.assertTrusted('Patient', id);
    if (![dto.phone, dto.citizenId, dto.insuranceNumber, dto.emergencyContact].some((value) => value?.trim())) {
      throw new BadRequestException('Hồ sơ bệnh nhân phải có ít nhất một thông tin liên hệ hoặc định danh hợp lệ.');
    }
    const conflict = await this.repo.findIdentityConflict(dto, id);
    if (conflict) {
      throw new ConflictException(`Thông tin bệnh nhân trùng với hồ sơ ${conflict.patientCode}.`);
    }
    const before = buildPatientSnapshot(existing);

    const updated = await this.repo.update(
      id,
      {
        fullName: dto.fullName,
        gender: dto.gender,
        birthDate: dto.birthDate,
        citizenId: dto.citizenId,
        phone: dto.phone,
        address: dto.address,
        insuranceNumber: dto.insuranceNumber,
        emergencyContact: dto.emergencyContact,
      },
      (patient, tx) => this.integrity.anchorChange(patient, 'UPDATE', actorId, before, tx),
    );

    return updated;
  }
}
