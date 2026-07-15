import { Inject, Injectable } from '@nestjs/common';
import { VISIT_REPOSITORY, VisitRepositoryPort } from '../ports/visit.repository.port';

/**
 * Suggests active examination departments for intake, optionally filtered by
 * specialty.
 */
@Injectable()
export class SuggestDepartmentsUseCase {
  constructor(@Inject(VISIT_REPOSITORY) private readonly repo: VisitRepositoryPort) {}

  execute(specialty: string) {
    return this.repo.suggestDepartments(specialty);
  }
}
