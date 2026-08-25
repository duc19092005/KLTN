import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { MedicalOrderStatus } from '@prisma/client';
import { AuthUser } from '../../../../common/types/auth-user.type';
import { ClinicalAuditTrustService } from '../../../../infrastructure/audit';
import { CreateMedicalResultDto } from '../../dto/medical-order.dto';
import { MedicalOrderAccessPolicy } from '../policies/medical-order-access.policy';
import { MEDICAL_ORDER_REPOSITORY, MedicalOrderRepositoryPort } from '../ports/medical-order.repository.port';
import { NotificationService } from '../../../notification/services/notification.service';
import {
  MEDICAL_ORDER_INTEGRITY_ANCHOR,
  MEDICAL_RESULT_INTEGRITY_ANCHOR,
  MedicalOrderIntegrityAnchorPort,
  MedicalResultIntegrityAnchorPort,
} from '../ports/medical-integrity-anchor.port';
import {
  VISIT_INTEGRITY_ANCHOR,
  VisitIntegrityAnchorPort,
} from '../../../visit/application/ports/visit-integrity-anchor.port';

/**
 * LAB_MANAGER returns a result for an order in their department during an
 * approved active shift.
 */
@Injectable()
export class CreateMedicalResultUseCase {
  constructor(
    @Inject(MEDICAL_ORDER_REPOSITORY) private readonly repo: MedicalOrderRepositoryPort,
    private readonly accessPolicy: MedicalOrderAccessPolicy,
    @Inject(MEDICAL_ORDER_INTEGRITY_ANCHOR) private readonly orderIntegrity: MedicalOrderIntegrityAnchorPort,
    @Inject(MEDICAL_RESULT_INTEGRITY_ANCHOR) private readonly resultIntegrity: MedicalResultIntegrityAnchorPort,
    @Inject(VISIT_INTEGRITY_ANCHOR) private readonly visitIntegrity: VisitIntegrityAnchorPort,
    private readonly notificationService: NotificationService,
    private readonly clinicalTrust: ClinicalAuditTrustService,
  ) {}

  async execute(orderId: string, dto: CreateMedicalResultDto, user: AuthUser, demoMode = false): Promise<unknown> {
    const order = await this.repo.findOrderForManage(orderId);
    if (!order) throw new NotFoundException('Không tìm thấy phiếu chỉ định.');

    await this.accessPolicy.assertCanManageOrder(order, user, () => this.resolveStaff(user.sub));
    await this.assertDepartmentMatch(order.targetDepartmentId, user);

    if (([MedicalOrderStatus.RESULT_READY, MedicalOrderStatus.CANCELLED] as MedicalOrderStatus[]).includes(order.status)) {
      throw new BadRequestException('Không thể trả kết quả cho phiếu đã sẵn sàng hoặc đã hủy.');
    }
    if (!dto.files?.length) {
      throw new BadRequestException('Vui lòng cung cấp ít nhất một file kết quả PDF hoặc hình ảnh.');
    }
    for (const file of dto.files) {
      if (
        file.storageProvider?.toUpperCase() !== 'S3' ||
        !file.bucket?.trim() ||
        !file.objectKey?.trim() ||
        !file.sha256?.trim()
      ) {
        throw new BadRequestException('File kết quả y tế phải có đầy đủ bucket, objectKey và SHA-256 của AWS S3 private.');
      }
      if (file.url) {
        throw new BadRequestException('Không được lưu URL công khai cho file kết quả y tế mới.');
      }
    }

    const resultPayload = await this.repo.createResultWithTransitions(
      {
        orderId,
        performedById: user.sub,
        note: dto.note?.trim() || undefined,
        files: dto.files.map((file) => ({
          fileName: file.fileName,
          originalName: file.originalName,
          mimeType: file.mimeType,
          size: file.size,
          url: null,
          storageProvider: 'S3',
          bucket: file.bucket.trim(),
          objectKey: file.objectKey.trim(),
          sha256: file.sha256.trim(),
          etag: file.etag ?? null,
        })),
      },
      order.visitId,
      async ({ result, order: updatedOrder, visitTransition }, tx) => {
        await this.resultIntegrity.anchorChange(
          { ...(result as Record<string, unknown>), visitId: order.visitId },
          'CREATE',
          user.sub,
          null,
          tx,
        );

        await this.orderIntegrity.anchorChange(
          updatedOrder,
          'UPDATE',
          user.sub,
          { orderId, visitId: order.visitId, status: order.status },
          tx,
        );

        if (visitTransition) {
          await this.visitIntegrity.anchorChange(
            visitTransition.visit,
            'UPDATE',
            user.sub,
            { visitId: visitTransition.visit.id, status: visitTransition.previousStatus },
            tx,
          );
        }
      },
      async (tx) => {
        await this.clinicalTrust.assertManyTrusted([
          { entity: 'MedicalOrder', entityId: orderId },
          { entity: 'Visit', entityId: order.visitId },
        ], tx);
      },
    );

    try {
      const resData = resultPayload as any;
      const orderData = resData?.order;
      if (orderData && orderData.doctor?.staffProfile?.userId) {
        await this.notificationService.createNotification(
          orderData.doctor.staffProfile.userId,
          'Có kết quả cận lâm sàng',
          `Đã có kết quả chỉ định ${orderData.orderType} (Mã: ${orderData.orderCode}) của bệnh nhân ${orderData.patient?.fullName || 'N/A'}.`,
        );
      }
    } catch (err) {
      console.error('Failed to send result creation notifications:', err);
    }

    return resultPayload;
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
