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
      if (!staff.departmentId) throw new ForbiddenException('LAB_MANAGER staff profile is not assigned to any department');
      return { targetDepartmentId: staff.departmentId };
    }

    throw new ForbiddenException('User role is not allowed to access medical orders');
  }

  /** Manage (update status / create result / upload files) authorization. */
  async assertCanManageOrder(
    order: OrderForAccess,
    user: AuthUser,
    resolveStaff: () => Promise<StaffIdentity>,
  ): Promise<void> {
    if (user.role === UserRole.ADMIN) return;

    if (user.role !== UserRole.LAB_MANAGER) {
      throw new ForbiddenException('Only ADMIN or LAB_MANAGER can update/upload results for medical orders');
    }

    const staff = await resolveStaff();
    if (!staff.departmentId) throw new ForbiddenException('LAB_MANAGER staff profile is not assigned to any department');
    if (!order.targetDepartmentId || order.targetDepartmentId !== staff.departmentId) {
      throw new ForbiddenException('LAB_MANAGER can only process medical orders assigned to their department');
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
        throw new ForbiddenException('Doctor can only access result files of their own visits');
      }
      return;
    }

    if (user.role === UserRole.LAB_MANAGER) {
      await this.assertCanManageOrder(order, user, resolvers.resolveStaff);
      return;
    }

    throw new ForbiddenException('User role is not allowed to access result files');
  }
}
