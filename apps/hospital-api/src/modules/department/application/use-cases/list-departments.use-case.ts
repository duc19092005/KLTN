import { Inject, Injectable } from '@nestjs/common';
import { OperationalStatus } from '@prisma/client';
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
    const { page, limit: requestedLimit } = getPagination(query);
    const limit = Math.min(requestedLimit, 10);
    const skip = (page - 1) * limit;
    const { items, total } = await this.repo.findManyPaginated(
      {
        search: query.search,
        departmentCode: query.departmentCode,
        name: query.name,
        status: query.status,
        excludeStatuses: query.status ? undefined : [OperationalStatus.DELETE],
        type: query.type,
        canReceiveOrders: query.canReceiveOrders,
      },
      skip,
      limit,
    );

    let evaluations;
    try {
      evaluations = await this.integrity.evaluateMany(items);
    } catch {
      evaluations = items.map((department: any) => ({
        id: department.id,
        status: 'VERIFICATION_UNAVAILABLE' as const,
        dbMatches: false,
        chainMatches: false,
        onChainHash: null,
        storedHash: department.hash256 ?? null,
        recomputedHash: null,
      }));
    }
    const byId = new Map<string, (typeof evaluations)[number]>(evaluations.map((evaluation) => [evaluation.id, evaluation]));
    const validatedItems = items.map((department: any) => {
      const integrityEval = byId.get(department.id)!;
      return {
        ...department,
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
    });

    return paginated(validatedItems, total, page, limit);
  }
}
