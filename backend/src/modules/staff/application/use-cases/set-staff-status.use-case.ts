import { Inject, Injectable } from '@nestjs/common';
import { UserStatus } from '@prisma/client';
import { STAFF_REPOSITORY, StaffRepositoryPort } from '../ports/staff.repository.port';
import { STAFF_INTEGRITY_ANCHOR, StaffIntegrityAnchorPort } from '../ports/staff-integrity-anchor.port';
import { StaffValidator } from '../services/staff.validator';
import { buildStaffSnapshot } from '../../domain/staff-snapshot';
import { DOCTOR_REANCHOR, DoctorReanchorPort } from '../../../doctor/application/ports/doctor-reanchor.port';
import { buildUnifiedDoctorSnapshot } from '../../../doctor/domain/doctor-snapshot';
import { EntityRecoveryService } from '../../../../infrastructure/audit/entity-recovery.service';

/**
 * Sets a staff account status (lock/unlock) and re-anchors. Behavior copied
 * verbatim from the former StaffService.setStatus(): bump tokenVersion on the
 * user, then re-anchor (doctor) or anchor UPDATE/DELETE (regular staff).
 * remove() uses DELETE; lock/hide uses INACTIVE.
 */
@Injectable()
export class SetStaffStatusUseCase {
  constructor(
    @Inject(STAFF_REPOSITORY) private readonly repo: StaffRepositoryPort,
    @Inject(STAFF_INTEGRITY_ANCHOR) private readonly integrity: StaffIntegrityAnchorPort,
    @Inject(DOCTOR_REANCHOR) private readonly doctorReanchor: DoctorReanchorPort,
    private readonly validator: StaffValidator,
    private readonly entityRecovery: EntityRecoveryService,
  ) {}

  async execute(id: string, status: UserStatus, actorId?: string) {
    const staff = await this.validator.ensureStaff(id);
    await this.entityRecovery.assertTrusted(staff.doctorProfile ? 'DoctorProfile' : 'StaffProfile', staff.doctorProfile?.id ?? id);
    const before = buildStaffSnapshot(staff);
    const isDoctor = Boolean(staff.doctorProfile);
    const doctorBefore = isDoctor ? buildUnifiedDoctorSnapshot({ ...staff.doctorProfile, staffProfile: staff }) : null;
    const action = status === UserStatus.DELETE ? 'DELETE' : 'UPDATE';
    const updated = await this.repo.setUserStatus(
      staff.userId,
      status,
      async (updatedUser, tx) => {
        if (isDoctor && updatedUser.staffProfile?.doctorProfile) {
          await this.doctorReanchor.reanchorSnapshot(
            { ...updatedUser.staffProfile.doctorProfile, staffProfile: { ...updatedUser.staffProfile, user: updatedUser } },
            actorId,
            doctorBefore,
            action,
            tx,
          );
        } else if (updatedUser.staffProfile) {
          await this.integrity.anchorChange(
            { ...updatedUser.staffProfile, user: updatedUser },
            action,
            actorId,
            before,
            tx,
          );
        }
      },
    );

    return updated;
  }
}
