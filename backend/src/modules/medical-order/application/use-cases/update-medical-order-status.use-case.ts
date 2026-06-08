import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { MedicalOrderStatus } from '@prisma/client';
import { AuthUser } from '../../../../common/types/auth-user.type';
import { MedicalOrderAccessPolicy } from '../policies/medical-order-access.policy';
import { MEDICAL_ORDER_REPOSITORY, MedicalOrderRepositoryPort } from '../ports/medical-order.repository.port';

/**
 * LAB_MANAGER/ADMIN updates an order status. completedAt is stamped when the
 * order becomes RESULT_READY or CANCELLED, matching the former service.
 */
@Injectable()
export class UpdateMedicalOrderStatusUseCase {
  constructor(
    @Inject(MEDICAL_ORDER_REPOSITORY) private readonly repo: MedicalOrderRepositoryPort,
    private readonly accessPolicy: MedicalOrderAccessPolicy,
  ) {}

  async execute(id: string, status: MedicalOrderStatus, user: AuthUser): Promise<unknown> {
    const order = await this.repo.findOrderForManage(id);
    if (!order) throw new NotFoundException('Không tìm thấy phiếu chỉ định.');

    await this.accessPolicy.assertCanManageOrder(order, user, () => this.resolveStaff(this.getActualStaffUserId(user)));
    await this.assertActiveApprovedShiftForOrder(order.targetDepartmentId, user);

    const completedAt =
      status === MedicalOrderStatus.RESULT_READY || status === MedicalOrderStatus.CANCELLED ? new Date() : undefined;
    return this.repo.updateStatus(id, status, completedAt);
  }

  private async resolveStaff(userId: string) {
    const staff = await this.repo.findStaffByUserId(userId);
    if (!staff) throw new ForbiddenException('Tài khoản hiện tại không có hồ sơ nhân sự.');
    return staff;
  }

  private async assertActiveApprovedShiftForOrder(targetDepartmentId: string | null, user: AuthUser) {
    if (user.role === 'ADMIN') return;
    if (!user.verified || !user.shiftId || !user.staffId) {
      throw new ForbiddenException('Chỉ nhân viên đã quét khuôn mặt trong ca trực được duyệt mới được cập nhật phiếu chỉ định.');
    }

    const shift = await this.repo.findActiveApprovedShift(user.shiftId, new Date(), this.isDemoMode());
    if (!shift || shift.staffId !== user.staffId || shift.staff.userId !== this.getActualStaffUserId(user)) {
      throw new ForbiddenException('Ca trực đã hết hiệu lực hoặc không khớp với nhân viên đang đăng nhập.');
    }
    if (!targetDepartmentId || shift.staff.departmentId !== targetDepartmentId) {
      throw new ForbiddenException('Ca trực hiện tại không thuộc phòng ban nhận phiếu chỉ định này.');
    }
  }

  private isDemoMode() {
    return process.env.DEMO_MODE === 'true';
  }

  private getActualStaffUserId(user: AuthUser) {
    return user.actualStaffId || user.sub;
  }
}
