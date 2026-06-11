import { Inject, Injectable } from '@nestjs/common';
import { DepartmentQueryDto } from '../../dto/department.dto';
import { getPagination, paginated } from '../../../shared/pagination.dto';
import { DEPARTMENT_REPOSITORY, DepartmentRepositoryPort } from '../ports/department.repository.port';
import { DEPARTMENT_INTEGRITY_ANCHOR, DepartmentIntegrityAnchorPort } from '../ports/department-integrity-anchor.port';

/** Lists departments with pagination + filters. Mirrors DepartmentService.findAll(). */
@Injectable()
export class ListDepartmentsUseCase {
  constructor(
    @Inject(DEPARTMENT_REPOSITORY) private readonly repo: DepartmentRepositoryPort,
    @Inject(DEPARTMENT_INTEGRITY_ANCHOR) private readonly integrity: DepartmentIntegrityAnchorPort,
  ) {}

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

    const validatedItems = await Promise.all(
      items.map(async (d: any) => {
        let integrityEval;
        try {
          integrityEval = await this.integrity.evaluate(d);
        } catch (err) {
          integrityEval = {
            status: 'UNANCHORED',
            dbMatches: false,
            chainMatches: false,
            onChainHash: null,
            storedHash: null,
            recomputedHash: null,
          };
        }

        return {
          ...d,
          blockchainStatus: integrityEval.status,
          audit: {
            status: integrityEval.status,
            dbMatches: integrityEval.dbMatches,
            chainMatches: integrityEval.chainMatches,
            onChainHash: integrityEval.onChainHash,
            storedHash: integrityEval.storedHash,
            recomputedHash: integrityEval.recomputedHash,
          },
        };
      })
    );

    return paginated(validatedItems, total, page, limit);
  }
}
