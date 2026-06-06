import { Inject, Injectable } from '@nestjs/common';
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

  async execute(dto: CreatePatientDto) {
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
    );

    // Anchor the newly created patient record for tamper-evidence
    try {
      await this.integrity.anchorChange(created, 'CREATE');
    } catch (err) {
      console.error('Error anchoring patient creation:', err);
    }

    return created;
  }
}
