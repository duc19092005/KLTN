import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { CLINICAL_ROOM_REPOSITORY, ClinicalRoomRepositoryPort } from '../ports/clinical-room.repository.port';

/**
 * Shared clinical-room validation rules, extracted verbatim from the former
 * ClinicalRoomService private helpers (ensureRoom, assertRoomCodeUnique,
 * assertDoctorExists).
 */
@Injectable()
export class ClinicalRoomValidator {
  constructor(@Inject(CLINICAL_ROOM_REPOSITORY) private readonly repo: ClinicalRoomRepositoryPort) {}

  async ensureRoom(id: string): Promise<void> {
    const room = await this.repo.findById(id);
    if (!room) throw new NotFoundException('Clinical room not found');
  }

  async assertRoomCodeUnique(roomCode: string, excludeId?: string): Promise<void> {
    const existing = await this.repo.findByRoomCode(roomCode);
    if (existing && existing.id !== excludeId) throw new ConflictException('Room code already exists');
  }

  async assertDoctorExists(doctorId: string): Promise<void> {
    if (!(await this.repo.doctorExists(doctorId))) throw new NotFoundException('Doctor profile not found');
  }
}
