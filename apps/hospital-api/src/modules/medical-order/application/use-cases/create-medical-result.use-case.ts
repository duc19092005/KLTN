import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { MedicalOrderStatus } from '@prisma/client';
import { AuthUser } from '../../../../common/types/auth-user.type';
import { AuditLoggerService } from '../../../../infrastructure/audit/audit-logger.service';
import { CreateMedicalResultDto } from '../../dto/medical-order.dto';
import { buildMedicalResultSnapshot } from '../../domain/medical-result-snapshot';
import { buildMedicalOrderSnapshot } from '../../domain/medical-order-snapshot';
import { MedicalOrderAccessPolicy } from '../policies/medical-order-access.policy';
import { MEDICAL_ORDER_REPOSITORY, MedicalOrderRepositoryPort } from '../ports/medical-order.repository.port';
import { NotificationService } from '../../../notification/services/notification.service';
import { buildVisitSnapshot } from '../../../visit/domain/visit-snapshot';

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
    private readonly notificationService: NotificationService,
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
        const resultSnapshot = buildMedicalResultSnapshot({
          ...result,
          visitId: order.visitId,
        });
        await this.audit.recordV2(
          {
            entity: 'MedicalResult',
            entityId: resultSnapshot.resultId,
            action: 'CREATE',
            actorId: user.sub,
            before: null,
            after: resultSnapshot,
            metadata: { schema: 'KLTN_MEDICAL_RESULT_AUDIT_V2' },
            onChainStatus: 'PENDING',
          },
          tx,
        );

        const orderSnapshot = buildMedicalOrderSnapshot(updatedOrder as Parameters<typeof buildMedicalOrderSnapshot>[0]);
        await this.audit.recordV2(
          {
            entity: 'MedicalOrder',
            entityId: orderId,
            action: 'UPDATE',
            actorId: user.sub,
            before: { orderId, visitId: order.visitId, status: order.status },
            after: orderSnapshot,
            metadata: { schema: 'KLTN_MEDICAL_ORDER_STATUS_AUDIT_V2' },
            onChainStatus: 'PENDING',
          },
          tx,
        );

        if (visitTransition) {
          await this.audit.recordV2(
            {
              entity: 'Visit',
              entityId: visitTransition.visit.id,
              action: 'UPDATE',
              actorId: user.sub,
              before: { visitId: visitTransition.visit.id, status: visitTransition.previousStatus },
              after: buildVisitSnapshot(visitTransition.visit),
              metadata: { schema: 'KLTN_VISIT_STATUS_AUDIT_V2' },
              onChainStatus: 'PENDING',
            },
            tx,
          );
        }
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
