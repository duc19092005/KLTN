import { Inject, Injectable } from '@nestjs/common';
import {
  PARACLINICAL_SHIFT_REPOSITORY,
  ParaclinicalShiftRepositoryPort,
} from '../ports/paraclinical-shift.repository.port';

/**
 * List all PENDING shifts awaiting approval, optionally filtered by department.
 */
@Injectable()
export class ListPendingShiftsUseCase {
  constructor(
    @Inject(PARACLINICAL_SHIFT_REPOSITORY) private readonly repo: ParaclinicalShiftRepositoryPort,
  ) {}

  async execute(departmentId?: string) {
    return this.repo.findPendingShifts(departmentId);
  }
}
