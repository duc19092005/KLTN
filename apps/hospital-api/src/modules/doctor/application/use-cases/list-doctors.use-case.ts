import { Inject, Injectable } from '@nestjs/common';
import { DoctorQueryDto } from '../../dto/doctor.dto';
import { getPagination, paginated } from '../../../shared/pagination.dto';
import { DOCTOR_REPOSITORY, DoctorRepositoryPort } from '../ports/doctor.repository.port';
import { DOCTOR_INTEGRITY_ANCHOR, DoctorIntegrityAnchorPort } from '../ports/doctor-integrity-anchor.port';

/** Lists doctors with pagination + specialty/search filter. Mirrors DoctorService.findAll(). */
@Injectable()
export class ListDoctorsUseCase {
  constructor(
    @Inject(DOCTOR_REPOSITORY) private readonly repo: DoctorRepositoryPort,
    @Inject(DOCTOR_INTEGRITY_ANCHOR) private readonly integrity: DoctorIntegrityAnchorPort,
  ) {}

  async execute(query: DoctorQueryDto) {
    const { page, limit, skip } = getPagination(query);
    const { items, total } = await this.repo.findManyPaginated({ specialty: query.specialty, search: query.search, status: query.status, includeDeleted: query.includeDeleted }, skip, limit);

    const validatedItems = await Promise.all(
      items.map(async (doctor: any) => {
        let integrityEval;
        try {
          integrityEval = await this.integrity.evaluate(doctor, true);
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
          ...doctor,
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
