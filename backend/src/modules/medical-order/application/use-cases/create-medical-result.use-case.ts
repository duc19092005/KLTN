import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { MedicalOrderStatus } from '@prisma/client';
import { AuthUser } from '../../../../common/types/auth-user.type';
import { AuditLoggerService } from '../../../../infrastructure/audit/audit-logger.service';
import { CreateMedicalResultDto } from '../../dto/medical-order.dto';
import {
  buildMedicalOrderStatusAuditSnapshot,
  buildMedicalResultAuditSnapshot,
  buildVisitStatusAuditSnapshot,
} from '../../domain/medical-result-audit-snapshot';
import { MedicalOrderAccessPolicy } from '../policies/medical-order-access.policy';
import { MEDICAL_ORDER_REPOSITORY, MedicalOrderRepositoryPort } from '../ports/medical-order.repository.port';

/**
 * LAB_MANAGER returns a result for an order in their department during an
 * approved active shift.
 */
@Injectable()
export class CreateMedicalResultUseCase {
  constructor(
    @Inject(MEDICAL_ORDER_REPOSITORY) private readonly repo: MedicalOrderRepositoryPort,
    private readonly accessPolicy: MedicalOrderAccessPolicy,
    private readonly audit: AuditLoggerService,
  ) {}

  async execute(orderId: string, dto: CreateMedicalResultDto, user: AuthUser, demoMode = false): Promise<unknown> {
    const order = await this.repo.findOrderForManage(orderId);
    if (!order) throw new NotFoundException('Không tìm thấy phiếu chỉ định.');

    await this.accessPolicy.assertCanManageOrder(order, user, () => this.resolveStaff(user.sub));
    await this.assertActiveApprovedShiftForOrder(order.targetDepartmentId, user, demoMode);

    if (([MedicalOrderStatus.RESULT_READY, MedicalOrderStatus.CANCELLED] as MedicalOrderStatus[]).includes(order.status)) {
      throw new BadRequestException('Không thể trả kết quả cho phiếu đã sẵn sàng hoặc đã hủy.');
    }
    if (!dto.files?.length) {
      throw new BadRequestException('Vui lòng cung cấp ít nhất một file kết quả PDF hoặc hình ảnh.');
    }

    return this.repo.createResultWithTransitions(
      {
        orderId,
        performedById: user.sub,
        note: dto.note?.trim() || undefined,
        files: dto.files.map((file) => ({
          fileName: file.fileName,
          originalName: file.originalName,
          mimeType: file.mimeType,
          size: file.size,
          url: file.url,
        })),
      },
      order.visitId,
      async ({ result, order: updatedOrder, visitTransition }, tx) => {
        const resultSnapshot = buildMedicalResultAuditSnapshot(
          result as Parameters<typeof buildMedicalResultAuditSnapshot>[0],
          order.visitId,
          MedicalOrderStatus.RESULT_READY,
        );
        const { salt: resultSalt, hash: resultHash } = this.audit.hashSnapshot(resultSnapshot);
        await this.audit.record(
          {
            entity: 'MedicalResult',
            entityId: resultSnapshot.resultId,
            action: 'CREATE',
            actorId: user.sub,
            dataHash: resultHash,
            dataSalt: resultSalt,
            before: null,
            after: resultSnapshot,
            metadata: { schema: 'KLTN_MEDICAL_RESULT_AUDIT_V1' },
            onChainStatus: 'PENDING',
          },
          tx,
        );

        const orderSnapshot = buildMedicalOrderStatusAuditSnapshot(orderId, order.visitId, MedicalOrderStatus.RESULT_READY);
        const { salt: orderSalt, hash: orderHash } = this.audit.hashSnapshot(orderSnapshot);
        await this.audit.record(
          {
            entity: 'MedicalOrder',
            entityId: orderId,
            action: 'UPDATE',
            actorId: user.sub,
            dataHash: orderHash,
            dataSalt: orderSalt,
            before: { orderId, visitId: order.visitId, status: order.status },
            after: orderSnapshot,
            metadata: { schema: 'KLTN_MEDICAL_ORDER_STATUS_AUDIT_V1' },
            onChainStatus: 'PENDING',
          },
          tx,
        );

        if (visitTransition) {
          const visitSnapshot = buildVisitStatusAuditSnapshot(visitTransition.visitId, visitTransition.status);
          const { salt: visitSalt, hash: visitHash } = this.audit.hashSnapshot(visitSnapshot);
          await this.audit.record(
            {
              entity: 'Visit',
              entityId: visitTransition.visitId,
              action: 'UPDATE',
              actorId: user.sub,
              dataHash: visitHash,
              dataSalt: visitSalt,
              before: { visitId: visitTransition.visitId, status: order.status },
              after: visitSnapshot,
              metadata: { schema: 'KLTN_VISIT_STATUS_AUDIT_V1' },
              onChainStatus: 'PENDING',
            },
            tx,
          );
        }
      },
    );
  }

  private async resolveStaff(userId: string) {
    const staff = await this.repo.findStaffByUserId(userId);
    if (!staff) throw new ForbiddenException('Tài khoản hiện tại không có hồ sơ nhân sự.');
    return staff;
  }

  private async assertActiveApprovedShiftForOrder(targetDepartmentId: string | null, user: AuthUser, demoMode = false) {
    if (user.role === 'ADMIN') return;
    if (!user.verified) {
      throw new ForbiddenException('Chỉ nhân viên đã xác thực khuôn mặt và đang có ca trực được duyệt mới được trả kết quả.');
    }

    const staff = await this.resolveStaff(user.sub);
    if (!targetDepartmentId || staff.departmentId !== targetDepartmentId) {
      throw new ForbiddenException('Nhân viên hiện tại không thuộc phòng ban nhận phiếu chỉ định này.');
    }

    const shift = await this.repo.findActiveApprovedShiftForStaffDepartment(
      staff.id,
      targetDepartmentId,
      new Date(),
      this.isDemoMode(demoMode),
    );
    if (!shift || shift.staff.userId !== user.sub) {
      throw new ForbiddenException('Ca trực đã hết hiệu lực hoặc không khớp với nhân viên đang đăng nhập.');
    }
  }

  private isDemoMode(demoMode = false) {
    return demoMode || process.env.DEMO_MODE === 'true';
  }
}
