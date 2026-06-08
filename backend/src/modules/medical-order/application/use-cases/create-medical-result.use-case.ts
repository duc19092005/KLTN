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
    if (!order) throw new NotFoundException('Không tìm thấy phiếu chỉ định.');

    await this.accessPolicy.assertCanManageOrder(order, user, () => this.resolveStaff(this.getActualStaffUserId(user)));
    await this.assertActiveApprovedShiftForOrder(order.targetDepartmentId, user);

    if (([MedicalOrderStatus.RESULT_READY, MedicalOrderStatus.CANCELLED] as MedicalOrderStatus[]).includes(order.status)) {
      throw new BadRequestException('Không thể trả kết quả cho phiếu đã sẵn sàng, hoàn tất hoặc đã hủy.');
    }
    if (!dto.files?.length) throw new BadRequestException('Vui lòng cung cấp ít nhất một file kết quả PDF hoặc hình ảnh.');

    return this.repo.createResultWithTransitions(
      {
        orderId,
        performedById: this.getActualStaffUserId(user),
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
    if (!staff) throw new ForbiddenException('Tài khoản hiện tại không có hồ sơ nhân sự.');
    return staff;
  }

  private async assertActiveApprovedShiftForOrder(targetDepartmentId: string | null, user: AuthUser) {
    if (user.role === 'ADMIN') return;
    if (!user.verified || !user.shiftId || !user.staffId) {
      throw new ForbiddenException('Chỉ nhân viên đã quét khuôn mặt trong ca trực được duyệt mới được trả kết quả.');
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
