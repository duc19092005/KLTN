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
    const { page, limit, skip } = getPagination(query);
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
      },
      skip,
      limit,
    );

    const validatedItems = await Promise.all(
      items.map(async (staff: any) => {
        let integrityEval;
        try {
          integrityEval = await this.integrity.evaluate(staff);
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
      })
    );

    return paginated(validatedItems, total, page, limit);
  }
}
