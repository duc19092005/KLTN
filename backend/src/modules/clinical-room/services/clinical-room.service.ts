import { Injectable } from '@nestjs/common';
import { AssignRoomDoctorDto, ClinicalRoomQueryDto, CreateClinicalRoomDto, UpdateClinicalRoomDto } from '../dto/clinical-room.dto';
import { CreateClinicalRoomUseCase } from '../application/use-cases/create-clinical-room.use-case';
import { ListClinicalRoomsUseCase } from '../application/use-cases/list-clinical-rooms.use-case';
import { UpdateClinicalRoomUseCase } from '../application/use-cases/update-clinical-room.use-case';
import { AssignRoomDoctorUseCase } from '../application/use-cases/assign-room-doctor.use-case';
import { RemoveClinicalRoomUseCase } from '../application/use-cases/remove-clinical-room.use-case';

/**
 * Facade preserving the controller-facing API. Each method delegates to a
 * single use case; no business logic lives here (Clean Architecture refactor).
 */
@Injectable()
export class ClinicalRoomService {
  constructor(
    private readonly createClinicalRoomUseCase: CreateClinicalRoomUseCase,
    private readonly listClinicalRoomsUseCase: ListClinicalRoomsUseCase,
    private readonly updateClinicalRoomUseCase: UpdateClinicalRoomUseCase,
    private readonly assignRoomDoctorUseCase: AssignRoomDoctorUseCase,
    private readonly removeClinicalRoomUseCase: RemoveClinicalRoomUseCase,
  ) {}

  create(dto: CreateClinicalRoomDto, actorId?: string) {
    return this.createClinicalRoomUseCase.execute(dto, actorId);
  }

  findAll(query: ClinicalRoomQueryDto) {
    return this.listClinicalRoomsUseCase.execute(query);
  }

  update(id: string, dto: UpdateClinicalRoomDto, actorId?: string) {
    return this.updateClinicalRoomUseCase.execute(id, dto, actorId);
  }

  assignDoctor(id: string, dto: AssignRoomDoctorDto, actorId?: string) {
    return this.assignRoomDoctorUseCase.execute(id, dto, actorId);
  }

  remove(id: string, actorId?: string) {
    return this.removeClinicalRoomUseCase.execute(id, actorId);
  }
}
