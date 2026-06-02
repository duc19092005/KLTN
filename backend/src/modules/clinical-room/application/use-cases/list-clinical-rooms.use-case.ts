import { Inject, Injectable } from '@nestjs/common';
import { ClinicalRoomQueryDto } from '../../dto/clinical-room.dto';
import { getPagination, paginated } from '../../../shared/pagination.dto';
import { CLINICAL_ROOM_REPOSITORY, ClinicalRoomRepositoryPort } from '../ports/clinical-room.repository.port';

/** Lists clinical rooms with pagination + filters. Mirrors ClinicalRoomService.findAll(). */
@Injectable()
export class ListClinicalRoomsUseCase {
  constructor(@Inject(CLINICAL_ROOM_REPOSITORY) private readonly repo: ClinicalRoomRepositoryPort) {}

  async execute(query: ClinicalRoomQueryDto) {
    const { page, limit, skip } = getPagination(query);
    const { items, total } = await this.repo.findManyPaginated(
      { roomCode: query.roomCode, roomName: query.roomName, status: query.status, search: query.search },
      skip,
      limit,
    );
    return paginated(items, total, page, limit);
  }
}
