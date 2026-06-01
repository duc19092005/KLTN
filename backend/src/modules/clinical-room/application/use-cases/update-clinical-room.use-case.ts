import { Inject, Injectable } from '@nestjs/common';
import { UpdateClinicalRoomDto } from '../../dto/clinical-room.dto';
import { CLINICAL_ROOM_REPOSITORY, ClinicalRoomRepositoryPort } from '../ports/clinical-room.repository.port';
import { ClinicalRoomValidator } from '../services/clinical-room.validator';

/**
 * Updates a clinical room. Behavior copied verbatim from the former
 * ClinicalRoomService.update(): ensures the room exists, validates room-code
 * uniqueness + doctor existence, then updates (clearing the doctor's previous
 * room atomically).
 */
@Injectable()
export class UpdateClinicalRoomUseCase {
  constructor(
    @Inject(CLINICAL_ROOM_REPOSITORY) private readonly repo: ClinicalRoomRepositoryPort,
    private readonly validator: ClinicalRoomValidator,
  ) {}

  async execute(id: string, dto: UpdateClinicalRoomDto, _actorId?: string) {
    await this.validator.ensureRoom(id);
    if (dto.roomCode) await this.validator.assertRoomCodeUnique(dto.roomCode, id);
    if (dto.doctorId) await this.validator.assertDoctorExists(dto.doctorId);

    return this.repo.updateWithDoctorReassign(id, {
      roomCode: dto.roomCode,
      roomName: dto.roomName,
      doctorId: dto.doctorId,
      floor: dto.floor,
      description: dto.description,
      status: dto.status,
    });
  }
}
