import { Inject, Injectable } from '@nestjs/common';
import {
  PARACLINICAL_SHIFT_REPOSITORY,
  ParaclinicalShiftRepositoryPort,
} from '../ports/paraclinical-shift.repository.port';

/**
 * List shifts for a specific room with optional date range filter.
 */
@Injectable()
export class ListRoomShiftsUseCase {
  constructor(
    @Inject(PARACLINICAL_SHIFT_REPOSITORY) private readonly repo: ParaclinicalShiftRepositoryPort,
  ) {}

  async execute(roomId: string, from?: Date, to?: Date) {
    return this.repo.findShiftsByRoom(roomId, from, to);
  }
}
