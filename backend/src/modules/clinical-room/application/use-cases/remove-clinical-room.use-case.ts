import { Inject, Injectable } from '@nestjs/common';
import { CLINICAL_ROOM_REPOSITORY, ClinicalRoomRepositoryPort } from '../ports/clinical-room.repository.port';
import { ClinicalRoomValidator } from '../services/clinical-room.validator';

/**
 * Deletes a clinical room. Behavior copied verbatim from the former
 * ClinicalRoomService.remove(): ensures the room exists, then hard-deletes.
 */
@Injectable()
export class RemoveClinicalRoomUseCase {
  constructor(
    @Inject(CLINICAL_ROOM_REPOSITORY) private readonly repo: ClinicalRoomRepositoryPort,
    private readonly validator: ClinicalRoomValidator,
  ) {}

  async execute(id: string, _actorId?: string) {
    await this.validator.ensureRoom(id);
    await this.repo.delete(id);
    return { deleted: true };
  }
}
