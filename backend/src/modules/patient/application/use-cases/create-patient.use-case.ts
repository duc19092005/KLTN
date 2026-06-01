import { Inject, Injectable } from '@nestjs/common';
import { CreatePatientDto } from '../../dto/patient.dto';
import { PATIENT_REPOSITORY, PatientRepositoryPort } from '../ports/patient.repository.port';

/**
 * Creates a patient. Behavior copied verbatim from the former
 * PatientService.create(): generates a patient code if not provided, then creates.
 */
@Injectable()
export class CreatePatientUseCase {
  constructor(@Inject(PATIENT_REPOSITORY) private readonly repo: PatientRepositoryPort) {}

  async execute(dto: CreatePatientDto) {
    const patientCode = dto.patientCode || (await this.repo.generatePatientCode());
    return this.repo.create(
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
  }
}
