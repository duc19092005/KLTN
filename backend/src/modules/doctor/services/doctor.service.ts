import { Injectable } from '@nestjs/common';
import { CreateDoctorDto, CreateDoctorWithStaffDto, DoctorQueryDto, UpdateDoctorDto } from '../dto/doctor.dto';
import { CreateDoctorUseCase } from '../application/use-cases/create-doctor.use-case';
import { CreateDoctorWithStaffUseCase } from '../application/use-cases/create-doctor-with-staff.use-case';
import { ListDoctorsUseCase } from '../application/use-cases/list-doctors.use-case';
import { UpdateDoctorUseCase } from '../application/use-cases/update-doctor.use-case';
import { VerifyDoctorUseCase } from '../application/use-cases/verify-doctor.use-case';
import { ReanchorDoctorForStaffUpdateUseCase } from '../application/use-cases/reanchor-doctor-for-staff-update.use-case';

/**
 * Facade preserving the controller-facing API. Each method delegates to a
 * single use case; no business logic lives here (Clean Architecture refactor).
 *
 * reanchorForStaffUpdate remains on the facade for backward compatibility, but
 * StaffModule now consumes the narrow DoctorReanchorPort instead.
 */
@Injectable()
export class DoctorService {
  constructor(
    private readonly createDoctorUseCase: CreateDoctorUseCase,
    private readonly createDoctorWithStaffUseCase: CreateDoctorWithStaffUseCase,
    private readonly listDoctorsUseCase: ListDoctorsUseCase,
    private readonly updateDoctorUseCase: UpdateDoctorUseCase,
    private readonly verifyDoctorUseCase: VerifyDoctorUseCase,
    private readonly reanchorUseCase: ReanchorDoctorForStaffUpdateUseCase,
  ) {}

  create(dto: CreateDoctorDto) {
    return this.createDoctorUseCase.execute(dto);
  }

  createWithStaff(dto: CreateDoctorWithStaffDto) {
    return this.createDoctorWithStaffUseCase.execute(dto);
  }

  findAll(query: DoctorQueryDto) {
    return this.listDoctorsUseCase.execute(query);
  }

  findOne(id: string) {
    return this.verifyDoctorUseCase.findOne(id);
  }

  update(id: string, dto: UpdateDoctorDto, actorId?: string) {
    return this.updateDoctorUseCase.execute(id, dto, actorId);
  }

  getHistory(id?: string) {
    return this.verifyDoctorUseCase.history(id);
  }

  verifyDoctor(id: string) {
    return this.verifyDoctorUseCase.verifyOne(id);
  }

  verifyAll() {
    return this.verifyDoctorUseCase.verifyAll();
  }

  reanchorForStaffUpdate(staffProfileId: string, actorId?: string) {
    return this.reanchorUseCase.reanchorForStaffUpdate(staffProfileId, actorId);
  }
}
