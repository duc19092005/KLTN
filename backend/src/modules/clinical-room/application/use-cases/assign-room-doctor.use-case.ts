import { Inject, Injectable } from '@nestjs/common';
import { AssignRoomDoctorDto } from '../../dto/clinical-room.dto';
import { CLINICAL_ROOM_REPOSITORY, ClinicalRoomRepositoryPort } from '../ports/clinical-room.repository.port';
import { ClinicalRoomValidator } from '../services/clinical-room.validator';

/**
 * Assigns, moves, or clears the doctor responsible for a room. Behavior copied
 * verbatim from the former ClinicalRoomService.assignDoctor() (clears the
 * doctor's previous room atomically).
 */
@Injectable()
export class AssignRoomDoctorUseCase {
  constructor(
    @Inject(CLINICAL_ROOM_REPOSITORY) private readonly repo: ClinicalRoomRepositoryPort,
    private readonly validator: ClinicalRoomValidator,
  ) {}

  async execute(id: string, dto: AssignRoomDoctorDto, _actorId?: string) {
    await this.validator.ensureRoom(id);
    if (dto.doctorId) await this.validator.assertDoctorExists(dto.doctorId);

    return this.repo.assignDoctor(id, dto.doctorId || null);
  }
}
