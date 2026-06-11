import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { UpdatePatientDto } from '../../dto/patient.dto';
import { PATIENT_REPOSITORY, PatientRepositoryPort } from '../ports/patient.repository.port';
import { PATIENT_INTEGRITY_ANCHOR, PatientIntegrityAnchorPort } from '../ports/patient-integrity-anchor.port';
import { buildPatientSnapshot } from '../../domain/patient-snapshot';

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
  ) {}

  async findOne(id: string) {
    const patient = await this.repo.findByIdWithRelations(id);
    if (!patient) throw new NotFoundException('Không tìm thấy hồ sơ bệnh nhân.');
    return patient;
  }

  async update(id: string, dto: UpdatePatientDto) {
    const existing = await this.findOne(id);
    const before = buildPatientSnapshot(existing);

    const updated = await this.repo.update(id, {
      fullName: dto.fullName,
      gender: dto.gender,
      birthDate: dto.birthDate,
      citizenId: dto.citizenId,
      phone: dto.phone,
      address: dto.address,
      insuranceNumber: dto.insuranceNumber,
      emergencyContact: dto.emergencyContact,
    });

    // Anchor the updated patient record for tamper-evidence
    try {
      await this.integrity.anchorChange(updated, 'UPDATE', undefined, before);
    } catch (err) {
      console.error('Error anchoring patient update:', err);
    }

    return updated;
  }
}
