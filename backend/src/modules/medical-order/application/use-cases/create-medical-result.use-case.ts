import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { MedicalOrderStatus } from '@prisma/client';
import { AuthUser } from '../../../../common/types/auth-user.type';
import { CreateMedicalResultDto } from '../../dto/medical-order.dto';
import { MedicalOrderAccessPolicy } from '../policies/medical-order-access.policy';
import { MEDICAL_ORDER_REPOSITORY, MedicalOrderRepositoryPort } from '../ports/medical-order.repository.port';

/**
 * LAB_MANAGER returns a result for an order. Validation and the atomic
 * result+order+visit transition are copied verbatim from the former
 * MedicalOrderService.createResult().
 */
@Injectable()
export class CreateMedicalResultUseCase {
  constructor(
    @Inject(MEDICAL_ORDER_REPOSITORY) private readonly repo: MedicalOrderRepositoryPort,
    private readonly accessPolicy: MedicalOrderAccessPolicy,
  ) {}

  async execute(orderId: string, dto: CreateMedicalResultDto, user: AuthUser): Promise<unknown> {
    const order = await this.repo.findOrderForManage(orderId);
    if (!order) throw new NotFoundException('Medical order not found');

    await this.accessPolicy.assertCanManageOrder(order, user, () => this.resolveStaff(user.sub));

    if (([MedicalOrderStatus.RESULT_READY, MedicalOrderStatus.CANCELLED] as MedicalOrderStatus[]).includes(order.status)) {
      throw new BadRequestException('Cannot return result for an order that is already ready/completed/cancelled');
    }
    if (!dto.files?.length) throw new BadRequestException('At least one result PDF/image file is required');

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
    );
  }

  private async resolveStaff(userId: string) {
    const staff = await this.repo.findStaffByUserId(userId);
    if (!staff) throw new ForbiddenException('Current user does not have staff profile');
    return staff;
  }
}
