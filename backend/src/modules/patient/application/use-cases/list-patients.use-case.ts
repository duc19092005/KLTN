import { Inject, Injectable } from '@nestjs/common';
import { PatientQueryDto } from '../../dto/patient.dto';
import { getPagination, paginated } from '../../../shared/pagination.dto';
import { PATIENT_REPOSITORY, PatientRepositoryPort } from '../ports/patient.repository.port';

/** Lists patients with pagination + filters. Mirrors PatientService.findAll(). */
@Injectable()
export class ListPatientsUseCase {
  constructor(@Inject(PATIENT_REPOSITORY) private readonly repo: PatientRepositoryPort) {}

  async execute(query: PatientQueryDto) {
    const { page, limit, skip } = getPagination(query);
    const { items, total } = await this.repo.findManyPaginated(
      { citizenId: query.citizenId, phone: query.phone, search: query.search },
      skip,
      limit,
    );
    return paginated(items, total, page, limit);
  }
}
