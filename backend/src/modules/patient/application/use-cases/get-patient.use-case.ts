import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { UpdatePatientDto } from '../../dto/patient.dto';
import { PATIENT_REPOSITORY, PatientRepositoryPort } from '../ports/patient.repository.port';

/**
 * Fetch one patient and update a patient. Behavior copied verbatim from the
 * former PatientService.findOne()/update(): update first ensures the patient
 * exists (NotFound otherwise) before applying changes.
 */
@Injectable()
export class GetPatientUseCase {
  constructor(@Inject(PATIENT_REPOSITORY) private readonly repo: PatientRepositoryPort) {}

  async findOne(id: string) {
    const patient = await this.repo.findByIdWithRelations(id);
    if (!patient) throw new NotFoundException('Patient not found');
    return patient;
  }

  async update(id: string, dto: UpdatePatientDto) {
    await this.findOne(id);
    return this.repo.update(id, {
      fullName: dto.fullName,
      gender: dto.gender,
      birthDate: dto.birthDate,
      citizenId: dto.citizenId,
      phone: dto.phone,
      address: dto.address,
      insuranceNumber: dto.insuranceNumber,
      emergencyContact: dto.emergencyContact,
    });
  }
}
