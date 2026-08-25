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
    const { page, limit: requestedLimit } = getPagination(query);
    const limit = Math.min(requestedLimit, 10);
    const skip = (page - 1) * limit;
    const { items, total } = await this.repo.findManyPaginated({ specialty: query.specialty, search: query.search, status: query.status, includeDeleted: query.includeDeleted }, skip, limit);

    let evaluations;
    try {
      evaluations = await this.integrity.evaluateMany(items);
    } catch {
      evaluations = items.map((doctor: any) => ({
        id: doctor.id,
        status: 'VERIFICATION_UNAVAILABLE' as const,
        dbMatches: false,
        chainMatches: false,
        onChainHash: null,
        storedHash: doctor.hash256 ?? null,
        recomputedHash: null,
      }));
    }
    const byId = new Map<string, (typeof evaluations)[number]>(evaluations.map((evaluation) => [evaluation.id, evaluation]));
    const validatedItems = items.map((doctor: any) => {
      const integrityEval = byId.get(doctor.id)!;
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
    });

    return paginated(validatedItems, total, page, limit);
  }
}
