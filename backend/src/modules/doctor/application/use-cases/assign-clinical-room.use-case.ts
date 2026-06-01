import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { AssignClinicalRoomDto } from '../../dto/doctor.dto';
import { DOCTOR_REPOSITORY, DoctorRepositoryPort } from '../ports/doctor.repository.port';

/**
 * Assigns, moves, or clears a doctor's clinical room. Behavior copied verbatim
 * from the former DoctorService.assignRoom() (no integrity anchor, matching
 * previous behavior).
 */
@Injectable()
export class AssignClinicalRoomUseCase {
  constructor(@Inject(DOCTOR_REPOSITORY) private readonly repo: DoctorRepositoryPort) {}

  async execute(id: string, dto: AssignClinicalRoomDto) {
    const doctor = await this.repo.findByIdWithRelations(id);
    if (!doctor) throw new NotFoundException('Doctor profile not found');

    await this.repo.assignRoom(id, dto.clinicalRoomId || undefined);

    const refreshed = await this.repo.findByIdWithRelations(id);
    if (!refreshed) throw new NotFoundException('Doctor profile not found');
    return refreshed;
  }
}
