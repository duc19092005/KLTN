import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { MedicalOrderStatus } from '@prisma/client';
import { AuthUser } from '../../../../common/types/auth-user.type';
import { ClinicalAuditTrustService } from '../../../../infrastructure/audit';
import { MedicalOrderAccessPolicy } from '../policies/medical-order-access.policy';
import { MEDICAL_ORDER_REPOSITORY, MedicalOrderRepositoryPort } from '../ports/medical-order.repository.port';
import {
  MEDICAL_ORDER_INTEGRITY_ANCHOR,
  MedicalOrderIntegrityAnchorPort,
} from '../ports/medical-integrity-anchor.port';

/**
 * LAB_MANAGER/ADMIN updates an order status. LAB_MANAGER must be the real
 * staff account for the target department and have an active approved shift.
 *
 * Every status change is recorded in the audit log (MedicalOrder UPDATE) inside
 * the same transaction so the live DB state always matches the anchored audit
 * snapshot (no ENTITY_INTEGRITY_WARNING on the admin integrity page).
 */
@Injectable()
export class UpdateMedicalOrderStatusUseCase {
  constructor(
    @Inject(MEDICAL_ORDER_REPOSITORY) private readonly repo: MedicalOrderRepositoryPort,
    private readonly accessPolicy: MedicalOrderAccessPolicy,
    @Inject(MEDICAL_ORDER_INTEGRITY_ANCHOR) private readonly orderIntegrity: MedicalOrderIntegrityAnchorPort,
    private readonly clinicalTrust: ClinicalAuditTrustService,
  ) {}

  async execute(id: string, status: MedicalOrderStatus, user: AuthUser, demoMode = false): Promise<unknown> {
    const order = await this.repo.findOrderForManage(id);
    if (!order) throw new NotFoundException('Không tìm thấy phiếu chỉ định.');

    await this.accessPolicy.assertCanManageOrder(order, user, () => this.resolveStaff(user.sub));
    await this.assertDepartmentMatch(order.targetDepartmentId, user);
    const allowed: Record<MedicalOrderStatus, MedicalOrderStatus[]> = {
      [MedicalOrderStatus.ORDERED]: [MedicalOrderStatus.IN_PROGRESS, MedicalOrderStatus.CANCELLED],
      [MedicalOrderStatus.IN_PROGRESS]: [MedicalOrderStatus.CANCELLED],
      [MedicalOrderStatus.RESULT_READY]: [],
      [MedicalOrderStatus.CANCELLED]: [],
    };
    if (!allowed[order.status].includes(status)) {
      throw new BadRequestException('Chuyển trạng thái chỉ định không hợp lệ. Kết quả chỉ được hoàn tất qua chức năng trả kết quả xét nghiệm.');
    }

    const completedAt =
      status === MedicalOrderStatus.RESULT_READY || status === MedicalOrderStatus.CANCELLED ? new Date() : undefined;
    return this.repo.updateStatus(id, status, completedAt, async (updatedOrder, tx) => {
      await this.orderIntegrity.anchorChange(
        updatedOrder,
        'UPDATE',
        user.sub,
        { orderId: order.id, visitId: order.visitId, status: order.status },
        tx,
      );
    }, async (tx) => {
      await this.clinicalTrust.assertManyTrusted([
        { entity: 'MedicalOrder', entityId: id },
        { entity: 'Visit', entityId: order.visitId },
      ], tx);
    });
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
