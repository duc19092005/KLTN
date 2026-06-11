import { Inject, Injectable } from '@nestjs/common';
import {
  PARACLINICAL_SHIFT_REPOSITORY,
  ParaclinicalShiftRepositoryPort,
} from '../ports/paraclinical-shift.repository.port';

/**
 * List shifts for a specific department with optional date range filter.
 */
@Injectable()
export class ListRoomShiftsUseCase {
  constructor(
    @Inject(PARACLINICAL_SHIFT_REPOSITORY) private readonly repo: ParaclinicalShiftRepositoryPort,
  ) {}

  async execute(departmentId: string, from?: Date, to?: Date) {
    return this.repo.findShiftsByDepartment(departmentId, from, to);
  }
}
