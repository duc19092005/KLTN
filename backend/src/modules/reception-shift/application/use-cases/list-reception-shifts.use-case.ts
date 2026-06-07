import { Inject, Injectable } from '@nestjs/common';
import {
  ListReceptionShiftsFilter,
  RECEPTION_SHIFT_REPOSITORY,
  ReceptionShiftRepositoryPort,
} from '../ports/reception-shift.repository.port';

/**
 * Lists reception shifts. Filter is intentionally permissive: callers (controller)
 * pre-scope it based on the actor's role (e.g. a receptionist gets staffId pinned
 * to their own profile to prevent cross-staff snooping).
 */
@Injectable()
export class ListReceptionShiftsUseCase {
  constructor(
    @Inject(RECEPTION_SHIFT_REPOSITORY) private readonly repo: ReceptionShiftRepositoryPort,
  ) {}

  execute(filter: ListReceptionShiftsFilter) {
    return this.repo.list(filter);
  }
}
