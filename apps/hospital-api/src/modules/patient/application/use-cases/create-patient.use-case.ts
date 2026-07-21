import { BadRequestException, ConflictException, Inject, Injectable } from '@nestjs/common';
import { CreatePatientDto } from '../../dto/patient.dto';
import { PATIENT_REPOSITORY, PatientRepositoryPort } from '../ports/patient.repository.port';
import { PATIENT_INTEGRITY_ANCHOR, PatientIntegrityAnchorPort } from '../ports/patient-integrity-anchor.port';

/**
 * Creates a patient. Behavior copied verbatim from the former
 * PatientService.create(): generates a patient code if not provided, then creates.
 * After creation, anchors the patient record for tamper-evidence.
 */
@Injectable()
export class CreatePatientUseCase {
  constructor(
    @Inject(PATIENT_REPOSITORY) private readonly repo: PatientRepositoryPort,
    @Inject(PATIENT_INTEGRITY_ANCHOR) private readonly integrity: PatientIntegrityAnchorPort,
  ) {}

  async execute(dto: CreatePatientDto, actorId?: string) {
    if (![dto.phone, dto.citizenId, dto.insuranceNumber, dto.emergencyContact].some((value) => value?.trim())) {
      throw new BadRequestException('Hồ sơ bệnh nhân phải có ít nhất một thông tin liên hệ hoặc định danh hợp lệ.');
    }
    const conflict = await this.repo.findIdentityConflict(dto);
    if (conflict) {
      throw new ConflictException(`Thông tin bệnh nhân trùng với hồ sơ ${conflict.patientCode}.`);
    }
    const patientCode = dto.patientCode || (await this.repo.generatePatientCode());
    const created = await this.repo.create(
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
      patientCode,
      (patient, tx) => this.integrity.anchorChange(patient, 'CREATE', actorId, null, tx),
    );

    return created;
  }
}
