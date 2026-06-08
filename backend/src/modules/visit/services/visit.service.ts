import { Injectable } from '@nestjs/common';
import { VisitStatus } from '@prisma/client';
import { AuthUser } from '../../../common/types/auth-user.type';
import { CreateVisitDto, VisitQueryDto } from '../dto/visit.dto';
import { CreateVisitUseCase } from '../application/use-cases/create-visit.use-case';
import { ListVisitsUseCase } from '../application/use-cases/list-visits.use-case';
import { SuggestDepartmentsUseCase } from '../application/use-cases/suggest-departments.use-case';
import { UpdateVisitStatusUseCase } from '../application/use-cases/update-visit-status.use-case';

/**
 * Facade preserving the controller-facing API. Each method delegates to a single
 * use case; no business logic lives here (Clean Architecture refactor).
 */
@Injectable()
export class VisitService {
  constructor(
    private readonly createVisitUseCase: CreateVisitUseCase,
    private readonly listVisitsUseCase: ListVisitsUseCase,
    private readonly updateVisitStatusUseCase: UpdateVisitStatusUseCase,
    private readonly suggestDepartmentsUseCase: SuggestDepartmentsUseCase,
  ) {}

  create(dto: CreateVisitDto) {
    return this.createVisitUseCase.execute(dto);
  }

  findAll(query: VisitQueryDto, user?: AuthUser) {
    return this.listVisitsUseCase.execute({ query, user });
  }

  updateStatus(id: string, status: VisitStatus, user?: AuthUser) {
    return this.updateVisitStatusUseCase.execute({ id, status, user });
  }

  suggestDepartments(specialty: string) {
    return this.suggestDepartmentsUseCase.execute(specialty);
  }
}
