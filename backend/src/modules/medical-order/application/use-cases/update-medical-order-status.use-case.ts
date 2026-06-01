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
    if (!order) throw new NotFoundException('Medical order not found');

    await this.accessPolicy.assertCanManageOrder(order, user, () => this.resolveStaff(user.sub));

    const completedAt =
      status === MedicalOrderStatus.RESULT_READY || status === MedicalOrderStatus.CANCELLED ? new Date() : undefined;
    return this.repo.updateStatus(id, status, completedAt);
  }

  private async resolveStaff(userId: string) {
    const staff = await this.repo.findStaffByUserId(userId);
    if (!staff) throw new ForbiddenException('Current user does not have staff profile');
    return staff;
  }
}
