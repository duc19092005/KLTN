import { Inject, Injectable } from '@nestjs/common';
import { UserStatus } from '@prisma/client';
import { STAFF_REPOSITORY, StaffRepositoryPort } from '../ports/staff.repository.port';
import { STAFF_INTEGRITY_ANCHOR, StaffIntegrityAnchorPort } from '../ports/staff-integrity-anchor.port';
import { StaffValidator } from '../services/staff.validator';
import { buildStaffSnapshot } from '../../domain/staff-snapshot';
import { DOCTOR_REANCHOR, DoctorReanchorPort } from '../../../doctor/application/ports/doctor-reanchor.port';
import { buildUnifiedDoctorSnapshot } from '../../../doctor/domain/doctor-snapshot';

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
  ) {}

  async execute(id: string, status: UserStatus, actorId?: string) {
    const staff = await this.validator.ensureStaff(id);
    const before = buildStaffSnapshot(staff);
    const isDoctor = Boolean(staff.doctorProfile);
    const doctorBefore = isDoctor ? buildUnifiedDoctorSnapshot({ ...staff.doctorProfile, staffProfile: staff }) : null;
    const updated = await this.repo.setUserStatus(staff.userId, status);

    if (isDoctor) {
      // Staff is a doctor → re-anchor the unified doctor hash
      const action = status === UserStatus.DELETE ? 'DELETE' : 'UPDATE';
      await this.doctorReanchor.reanchorForStaffUpdate(id, actorId, doctorBefore, action);
    } else if (updated.staffProfile) {
      // Ẩn/hiện tài khoản là thay đổi trạng thái mềm, không phải xóa hồ sơ.
      // Truyền kèm user mới để snapshot after có `status` thay vì null.
      const action = status === UserStatus.DELETE ? 'DELETE' : 'UPDATE';
      await this.integrity.anchorChange({ ...updated.staffProfile, user: updated }, action, actorId, before);
    }

    return updated;
  }
}
