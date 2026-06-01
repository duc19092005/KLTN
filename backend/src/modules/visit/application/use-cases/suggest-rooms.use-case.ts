import { Inject, Injectable } from '@nestjs/common';
import { VISIT_REPOSITORY, VisitRepositoryPort } from '../ports/visit.repository.port';

/**
 * Suggests active clinical rooms for intake, optionally filtered by doctor
 * specialty. Behavior copied verbatim from the former VisitService.suggestRooms().
 */
@Injectable()
export class SuggestRoomsUseCase {
  constructor(@Inject(VISIT_REPOSITORY) private readonly repo: VisitRepositoryPort) {}

  execute(specialty: string) {
    return this.repo.suggestRooms(specialty);
  }
}
