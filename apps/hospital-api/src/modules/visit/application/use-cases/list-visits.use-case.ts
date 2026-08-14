import { Inject, Injectable } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { AuthUser } from '../../../../common/types/auth-user.type';
import { getPagination, paginated } from '../../../shared/pagination.dto';
import { VisitQueryDto } from '../../dto/visit.dto';
import { VISIT_REPOSITORY, VisitRepositoryPort } from '../ports/visit.repository.port';

/**
 * Lists visits with pagination. Doctors are scoped to their department so they
 * can pick up WAITING and active visits in their assigned department queue.
 */
@Injectable()
export class ListVisitsUseCase {
  constructor(@Inject(VISIT_REPOSITORY) private readonly repo: VisitRepositoryPort) {}

  async execute(input: { query: VisitQueryDto; user?: AuthUser }) {
    const { query, user } = input;
    const { page, limit, skip } = getPagination(query);

    let departmentId = query.departmentId;
    let staffId = query.staffId;

    if (user?.role === UserRole.DOCTOR) {
      const doctor = await this.repo.findDoctorStaffByUserId(user.sub);
      departmentId = doctor?.departmentId ?? '__no-doctor-department__';
      // If no explicit staffId filter was passed in query, allow doctor to view
      // all department visits (unassigned or assigned to department staff).
      if (!query.staffId) {
        staffId = undefined;
      }
    }

    const { items, total } = await this.repo.findManyPaginated(
      {
        status: query.status,
        staffId,
        departmentId,
        patientId: query.patientId,
      },
      skip,
      limit,
    );

    return paginated(items, total, page, limit);
  }
}
