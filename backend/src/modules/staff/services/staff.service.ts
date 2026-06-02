import { Injectable } from '@nestjs/common';
import { UserStatus } from '@prisma/client';
import { CreateStaffDto, StaffQueryDto, UpdateStaffDto } from '../dto/staff.dto';
import { CreateStaffUseCase } from '../application/use-cases/create-staff.use-case';
import { ListStaffUseCase } from '../application/use-cases/list-staff.use-case';
import { UpdateStaffUseCase } from '../application/use-cases/update-staff.use-case';
import { SetStaffStatusUseCase } from '../application/use-cases/set-staff-status.use-case';
import { VerifyStaffUseCase } from '../application/use-cases/verify-staff.use-case';

/**
 * Facade preserving the controller-facing API. Each method delegates to a
 * single use case; no business logic lives here (Clean Architecture refactor).
 */
@Injectable()
export class StaffService {
  constructor(
    private readonly createStaffUseCase: CreateStaffUseCase,
    private readonly listStaffUseCase: ListStaffUseCase,
    private readonly updateStaffUseCase: UpdateStaffUseCase,
    private readonly setStaffStatusUseCase: SetStaffStatusUseCase,
    private readonly verifyStaffUseCase: VerifyStaffUseCase,
  ) {}

  create(dto: CreateStaffDto, actorId?: string) {
    return this.createStaffUseCase.execute(dto, actorId);
  }

  findAll(query: StaffQueryDto) {
    return this.listStaffUseCase.execute(query);
  }

  findOne(id: string) {
    return this.verifyStaffUseCase.findOne(id);
  }

  update(id: string, dto: UpdateStaffDto, actorId?: string) {
    return this.updateStaffUseCase.execute(id, dto, actorId);
  }

  setStatus(id: string, status: UserStatus, actorId?: string) {
    return this.setStaffStatusUseCase.execute(id, status, actorId);
  }

  remove(id: string, actorId?: string) {
    return this.setStaffStatusUseCase.execute(id, UserStatus.INACTIVE, actorId);
  }

  getHistory(id?: string) {
    return this.verifyStaffUseCase.history(id);
  }

  verifyStaff(id: string) {
    return this.verifyStaffUseCase.verifyOne(id);
  }

  verifyAll() {
    return this.verifyStaffUseCase.verifyAll();
  }
}
