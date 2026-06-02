import { Inject, Injectable } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { AuthUser } from '../../../../common/types/auth-user.type';
import { getPagination, paginated } from '../../../shared/pagination.dto';
import { VisitQueryDto } from '../../dto/visit.dto';
import { VISIT_REPOSITORY, VisitRepositoryPort } from '../ports/visit.repository.port';

/**
 * Lists visits with pagination. Doctors are implicitly scoped to their own
 * visits; other roles may filter by the query's doctorId. Behavior copied
 * verbatim from the former VisitService.findAll().
 */
@Injectable()
export class ListVisitsUseCase {
  constructor(@Inject(VISIT_REPOSITORY) private readonly repo: VisitRepositoryPort) {}

  async execute(input: { query: VisitQueryDto; user?: AuthUser }) {
    const { query, user } = input;
    const { page, limit, skip } = getPagination(query);

    const doctorId =
      user?.role === UserRole.DOCTOR ? await this.repo.findDoctorIdByUserId(user.sub) ?? undefined : query.doctorId;

    const { items, total } = await this.repo.findManyPaginated(
      {
        status: query.status,
        doctorId,
        clinicalRoomId: query.clinicalRoomId,
        patientId: query.patientId,
      },
      skip,
      limit,
    );

    return paginated(items, total, page, limit);
  }
}
