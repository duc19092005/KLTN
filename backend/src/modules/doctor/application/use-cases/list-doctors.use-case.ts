import { Inject, Injectable } from '@nestjs/common';
import { DoctorQueryDto } from '../../dto/doctor.dto';
import { getPagination, paginated } from '../../../shared/pagination.dto';
import { DOCTOR_REPOSITORY, DoctorRepositoryPort } from '../ports/doctor.repository.port';

/** Lists doctors with pagination + specialty/search filter. Mirrors DoctorService.findAll(). */
@Injectable()
export class ListDoctorsUseCase {
  constructor(@Inject(DOCTOR_REPOSITORY) private readonly repo: DoctorRepositoryPort) {}

  async execute(query: DoctorQueryDto) {
    const { page, limit, skip } = getPagination(query);
    const { items, total } = await this.repo.findManyPaginated({ specialty: query.specialty, search: query.search }, skip, limit);
    return paginated(items, total, page, limit);
  }
}
