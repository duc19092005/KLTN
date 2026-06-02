import { Inject, Injectable } from '@nestjs/common';
import { StaffQueryDto } from '../../dto/staff.dto';
import { getPagination, paginated } from '../../../shared/pagination.dto';
import { STAFF_REPOSITORY, StaffRepositoryPort } from '../ports/staff.repository.port';

/** Lists staff with pagination + filters. Mirrors StaffService.findAll(). */
@Injectable()
export class ListStaffUseCase {
  constructor(@Inject(STAFF_REPOSITORY) private readonly repo: StaffRepositoryPort) {}

  async execute(query: StaffQueryDto) {
    const { page, limit, skip } = getPagination(query);
    const { items, total } = await this.repo.findManyPaginated(
      {
        employeeCode: query.employeeCode,
        fullName: query.fullName,
        citizenId: query.citizenId,
        department: query.department,
        role: query.role,
        search: query.search,
      },
      skip,
      limit,
    );
    return paginated(items, total, page, limit);
  }
}
