import { Inject, Injectable } from '@nestjs/common';
import { DepartmentQueryDto } from '../../dto/department.dto';
import { getPagination, paginated } from '../../../shared/pagination.dto';
import { DEPARTMENT_REPOSITORY, DepartmentRepositoryPort } from '../ports/department.repository.port';

/** Lists departments with pagination + filters. Mirrors DepartmentService.findAll(). */
@Injectable()
export class ListDepartmentsUseCase {
  constructor(@Inject(DEPARTMENT_REPOSITORY) private readonly repo: DepartmentRepositoryPort) {}

  async execute(query: DepartmentQueryDto) {
    const { page, limit, skip } = getPagination(query);
    const { items, total } = await this.repo.findManyPaginated(
      {
        search: query.search,
        departmentCode: query.departmentCode,
        name: query.name,
        status: query.status,
        type: query.type,
        canReceiveOrders: query.canReceiveOrders,
      },
      skip,
      limit,
    );
    return paginated(items, total, page, limit);
  }
}
