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

  async execute(id: string, status: MedicalOrderStatus, user: AuthUser, demoMode = false): Promise<unknown> {
    const order = await this.repo.findOrderForManage(id);
    if (!order) throw new NotFoundException('Không tìm thấy phiếu chỉ định.');

    await this.accessPolicy.assertCanManageOrder(order, user, () => this.resolveStaff(user.sub));
    await this.assertDepartmentMatch(order.targetDepartmentId, user);

    const completedAt =
      status === MedicalOrderStatus.RESULT_READY || status === MedicalOrderStatus.CANCELLED ? new Date() : undefined;
    return this.repo.updateStatus(id, status, completedAt);
  }

  private async resolveStaff(userId: string) {
    const staff = await this.repo.findStaffByUserId(userId);
    if (!staff) throw new ForbiddenException('Tài khoản hiện tại không có hồ sơ nhân sự.');
    return staff;
  }

  private async assertDepartmentMatch(targetDepartmentId: string | null, user: AuthUser) {
    if (user.role === 'ADMIN') return;
    const staff = await this.resolveStaff(user.sub);
    if (!targetDepartmentId || staff.departmentId !== targetDepartmentId) {
      throw new ForbiddenException('Nhân viên hiện tại không thuộc phòng ban nhận phiếu chỉ định này.');
    }
  }
}
