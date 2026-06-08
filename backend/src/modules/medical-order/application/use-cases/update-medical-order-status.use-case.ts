import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { MedicalOrderStatus } from '@prisma/client';
import { AuthUser } from '../../../../common/types/auth-user.type';
import { MedicalOrderAccessPolicy } from '../policies/medical-order-access.policy';
import { MEDICAL_ORDER_REPOSITORY, MedicalOrderRepositoryPort } from '../ports/medical-order.repository.port';

/**
 * LAB_MANAGER/ADMIN updates an order status. LAB_MANAGER must be the real
 * staff account for the target department and have an active approved shift.
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

    await this.accessPolicy.assertCanManageOrder(order, user, () => this.resolveStaff(user.sub));
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
    if (!user.verified) {
      throw new ForbiddenException('Chỉ nhân viên đã xác thực khuôn mặt và đang có ca trực được duyệt mới được cập nhật phiếu chỉ định.');
    }

    const staff = await this.resolveStaff(user.sub);
    if (!targetDepartmentId || staff.departmentId !== targetDepartmentId) {
      throw new ForbiddenException('Nhân viên hiện tại không thuộc phòng ban nhận phiếu chỉ định này.');
    }

    const shift = await this.repo.findActiveApprovedShiftForStaffDepartment(
      staff.id,
      targetDepartmentId,
      new Date(),
      this.isDemoMode(),
    );
    if (!shift || shift.staff.userId !== user.sub) {
      throw new ForbiddenException('Ca trực đã hết hiệu lực hoặc không khớp với nhân viên đang đăng nhập.');
    }
  }

  private isDemoMode() {
    return process.env.DEMO_MODE === 'true';
  }
}
