import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { MedicalOrderStatus } from '@prisma/client';
import { AuthUser } from '../../../../common/types/auth-user.type';
import { CreateMedicalResultDto } from '../../dto/medical-order.dto';
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
  ) {}

  async execute(orderId: string, dto: CreateMedicalResultDto, user: AuthUser): Promise<unknown> {
    const order = await this.repo.findOrderForManage(orderId);
    if (!order) throw new NotFoundException('Không tìm thấy phiếu chỉ định.');

    await this.accessPolicy.assertCanManageOrder(order, user, () => this.resolveStaff(user.sub));
    await this.assertActiveApprovedShiftForOrder(order.targetDepartmentId, user);

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
    );
  }

  private async resolveStaff(userId: string) {
    const staff = await this.repo.findStaffByUserId(userId);
    if (!staff) throw new ForbiddenException('Tài khoản hiện tại không có hồ sơ nhân sự.');
    return staff;
  }

  private async assertActiveApprovedShiftForOrder(targetDepartmentId: string | null, user: AuthUser) {
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
