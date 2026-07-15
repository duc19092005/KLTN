import { Injectable } from '@nestjs/common';
import { CreatePatientDto, PatientQueryDto, UpdatePatientDto } from '../dto/patient.dto';
import { CreatePatientUseCase } from '../application/use-cases/create-patient.use-case';
import { ListPatientsUseCase } from '../application/use-cases/list-patients.use-case';
import { GetPatientUseCase } from '../application/use-cases/get-patient.use-case';

/**
 * Facade preserving the controller-facing API. Each method delegates to a
 * single use case; no business logic lives here (Clean Architecture refactor).
 */
@Injectable()
export class PatientService {
  constructor(
    private readonly createPatientUseCase: CreatePatientUseCase,
    private readonly listPatientsUseCase: ListPatientsUseCase,
    private readonly getPatientUseCase: GetPatientUseCase,
  ) {}

  create(dto: CreatePatientDto, actorId?: string) {
    return this.createPatientUseCase.execute(dto, actorId);
  }

  findAll(query: PatientQueryDto) {
    return this.listPatientsUseCase.execute(query);
  }

  findOne(id: string) {
    return this.getPatientUseCase.findOne(id);
  }

  update(id: string, dto: UpdatePatientDto, actorId?: string) {
    return this.getPatientUseCase.update(id, dto, actorId);
  }
}
