import { Inject, Injectable } from '@nestjs/common';
import { OperationalStatus } from '@prisma/client';
import { CreateClinicalRoomDto } from '../../dto/clinical-room.dto';
import { CLINICAL_ROOM_REPOSITORY, ClinicalRoomRepositoryPort } from '../ports/clinical-room.repository.port';
import { ClinicalRoomValidator } from '../services/clinical-room.validator';

/**
 * Creates a clinical room. Behavior copied verbatim from the former
 * ClinicalRoomService.create(): validates room-code uniqueness and doctor
 * existence, then creates (clearing the doctor's previous room atomically).
 */
@Injectable()
export class CreateClinicalRoomUseCase {
  constructor(
    @Inject(CLINICAL_ROOM_REPOSITORY) private readonly repo: ClinicalRoomRepositoryPort,
    private readonly validator: ClinicalRoomValidator,
  ) {}

  async execute(dto: CreateClinicalRoomDto, _actorId?: string) {
    await this.validator.assertRoomCodeUnique(dto.roomCode);
    if (dto.doctorId) await this.validator.assertDoctorExists(dto.doctorId);

    return this.repo.createWithDoctorReassign({
      roomCode: dto.roomCode,
      roomName: dto.roomName,
      doctorId: dto.doctorId || null,
      floor: dto.floor,
      description: dto.description,
      status: dto.status || OperationalStatus.ACTIVE,
    });
  }
}
