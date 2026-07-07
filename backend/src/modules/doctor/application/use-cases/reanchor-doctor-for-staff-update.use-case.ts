import { Inject, Injectable } from '@nestjs/common';
import { DoctorReanchorPort } from '../ports/doctor-reanchor.port';
import { DOCTOR_REPOSITORY, DoctorRepositoryPort } from '../ports/doctor.repository.port';
import { DOCTOR_INTEGRITY_ANCHOR, DoctorAnchorAction, DoctorIntegrityAnchorPort } from '../ports/doctor-integrity-anchor.port';
import { buildUnifiedDoctorSnapshot } from '../../domain/doctor-snapshot';

/**
 * Re-anchors the unified doctor hash after a staff update made from another
 * module (StaffModule). Implements DoctorReanchorPort so StaffModule depends on
 * a narrow interface instead of the whole DoctorService (removes forwardRef).
 *
 * Behavior copied verbatim from the former DoctorService.reanchorForStaffUpdate().
 */
@Injectable()
export class ReanchorDoctorForStaffUpdateUseCase implements DoctorReanchorPort {
  constructor(
    @Inject(DOCTOR_REPOSITORY) private readonly repo: DoctorRepositoryPort,
    @Inject(DOCTOR_INTEGRITY_ANCHOR) private readonly integrity: DoctorIntegrityAnchorPort,
  ) {}

  async reanchorForStaffUpdate(
    staffProfileId: string,
    actorId?: string,
    beforeSnapshot?: Record<string, unknown> | null,
    action: DoctorAnchorAction = 'UPDATE',
  ): Promise<void> {
    const doctor = await this.repo.findByStaffProfileId(staffProfileId);
    if (!doctor) return; // Not a doctor, nothing to re-anchor

    const before = beforeSnapshot ?? buildUnifiedDoctorSnapshot(doctor);
    // Re-fetch after staff update to get latest staff data
    const refreshed = await this.repo.findByIdWithRelations(doctor.id);
    if (!refreshed) return;
    await this.integrity.anchorChange(refreshed, action, actorId, before);
  }
}
