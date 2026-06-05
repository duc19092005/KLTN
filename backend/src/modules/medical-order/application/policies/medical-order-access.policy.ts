import { ForbiddenException, Injectable } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { AuthUser } from '../../../../common/types/auth-user.type';
import { OrderForAccess, StaffIdentity } from '../ports/medical-order.repository.port';

/**
 * Role-based access rules for medical orders, extracted verbatim from
 * MedicalOrderService (applyAccessScope, assertCanManageOrder, and the
 * download authorization branch).
 *
 * Identity lookups are injected as lazy resolver callbacks so the policy keeps
 * the decision logic (and exact ordering of checks / error messages) while the
 * repository supplies doctor/staff identities only when actually needed.
 */
@Injectable()
export class MedicalOrderAccessPolicy {
  /** Extra where-scope for listing orders, mirroring applyAccessScope(). */
  async buildListScope(
    user: AuthUser,
    resolveDoctorId: () => Promise<string>,
    resolveStaff: () => Promise<StaffIdentity>,
  ): Promise<{ doctorId?: string; targetDepartmentId?: string }> {
    if (user.role === UserRole.ADMIN) return {};

    if (user.role === UserRole.DOCTOR) {
      return { doctorId: await resolveDoctorId() };
    }

    if (user.role === UserRole.LAB_MANAGER) {
      const staff = await resolveStaff();
      if (!staff.departmentId) throw new ForbiddenException('Tài khoản trưởng khoa chưa được gán phòng ban.');
      return { targetDepartmentId: staff.departmentId };
    }

    throw new ForbiddenException('Vai trò hiện tại không được phép truy cập phiếu chỉ định.');
  }

  /** Manage (update status / create result / upload files) authorization. */
  async assertCanManageOrder(
    order: OrderForAccess,
    user: AuthUser,
    resolveStaff: () => Promise<StaffIdentity>,
  ): Promise<void> {
    if (user.role === UserRole.ADMIN) return;

    if (user.role !== UserRole.LAB_MANAGER) {
      throw new ForbiddenException('Chỉ quản trị viên hoặc trưởng khoa được cập nhật/tải kết quả phiếu chỉ định.');
    }

    const staff = await resolveStaff();
    if (!staff.departmentId) throw new ForbiddenException('Tài khoản trưởng khoa chưa được gán phòng ban.');
    if (!order.targetDepartmentId || order.targetDepartmentId !== staff.departmentId) {
      throw new ForbiddenException('Trưởng khoa chỉ được xử lý phiếu chỉ định thuộc phòng ban của mình.');
    }
  }

  /** Result-file download authorization. */
  async assertCanDownloadResultFile(
    order: { doctorId: string; targetDepartmentId: string | null },
    user: AuthUser,
    resolvers: { resolveDoctorId: () => Promise<string>; resolveStaff: () => Promise<StaffIdentity> },
  ): Promise<void> {
    if (user.role === UserRole.ADMIN) return;

    if (user.role === UserRole.DOCTOR) {
      const doctorId = await resolvers.resolveDoctorId();
      if (order.doctorId !== doctorId) {
        throw new ForbiddenException('Bác sĩ chỉ được truy cập file kết quả của lượt khám do mình phụ trách.');
      }
      return;
    }

    if (user.role === UserRole.LAB_MANAGER) {
      await this.assertCanManageOrder(order, user, resolvers.resolveStaff);
      return;
    }

    throw new ForbiddenException('Vai trò hiện tại không được phép truy cập file kết quả.');
  }
}
