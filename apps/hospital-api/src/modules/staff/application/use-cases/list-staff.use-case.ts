import { Inject, Injectable } from '@nestjs/common';
import { StaffQueryDto } from '../../dto/staff.dto';
import { getPagination, paginated } from '../../../shared/pagination.dto';
import { STAFF_REPOSITORY, StaffRepositoryPort } from '../ports/staff.repository.port';
import { STAFF_INTEGRITY_ANCHOR, StaffIntegrityAnchorPort } from '../ports/staff-integrity-anchor.port';

/** Lists staff with pagination + filters. Mirrors StaffService.findAll(). */
@Injectable()
export class ListStaffUseCase {
  constructor(
    @Inject(STAFF_REPOSITORY) private readonly repo: StaffRepositoryPort,
    @Inject(STAFF_INTEGRITY_ANCHOR) private readonly integrity: StaffIntegrityAnchorPort,
  ) {}

  async execute(query: StaffQueryDto) {
    const { page, limit: requestedLimit } = getPagination(query);
    const limit = Math.min(requestedLimit, 10);
    const skip = (page - 1) * limit;
    const { items, total } = await this.repo.findManyPaginated(
      {
        employeeCode: query.employeeCode,
        fullName: query.fullName,
        citizenId: query.citizenId,
        department: query.department,
        departmentId: query.departmentId,
        role: query.role,
        excludeRole: query.excludeRole,
        isManager: query.isManager,
        search: query.search,
        status: query.status,
        includeDeleted: query.includeDeleted,
      },
      skip,
      limit,
    );

    let evaluations;
    try {
      evaluations = await this.integrity.evaluateMany(items);
    } catch {
      evaluations = items.map((staff: any) => ({
        id: staff.id,
        status: 'VERIFICATION_UNAVAILABLE' as const,
        dbMatches: false,
        chainMatches: false,
        onChainHash: null,
        storedHash: staff.hash256 ?? null,
        recomputedHash: null,
      }));
    }
    const byId = new Map<string, (typeof evaluations)[number]>(evaluations.map((evaluation) => [evaluation.id, evaluation]));
    const validatedItems = items.map((staff: any) => {
      const integrityEval = byId.get(staff.id)!;
      return {
        ...staff,
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
