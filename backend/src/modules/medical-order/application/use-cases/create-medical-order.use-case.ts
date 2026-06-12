import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { VisitStatus } from '@prisma/client';
import { CreateMedicalOrderDto } from '../../dto/medical-order.dto';
import { MEDICAL_ORDER_REPOSITORY, MedicalOrderRepositoryPort } from '../ports/medical-order.repository.port';
import { PrismaService } from '../../../../infrastructure/prisma/prisma.service';
import { NotificationService } from '../../../notification/services/notification.service';

/**
 * Doctor creates a lab/imaging order for a visit in their examination
 * department. The issued MedicalOrder still stores DoctorProfile.id for
 * medical accountability, while Visit ownership uses StaffProfile.id.
 */
@Injectable()
export class CreateMedicalOrderUseCase {
  constructor(
    @Inject(MEDICAL_ORDER_REPOSITORY) private readonly repo: MedicalOrderRepositoryPort,
    private readonly prisma: PrismaService,
    private readonly notificationService: NotificationService,
  ) {}

  async execute(dto: CreateMedicalOrderDto, doctorUserId: string): Promise<unknown> {
    const visit = await this.repo.findVisitForOrder(dto.visitId);
    if (!visit) throw new NotFoundException('Không tìm thấy lượt khám.');

    const currentDoctor = await this.repo.findDoctorStaffByUserId(doctorUserId);
    if (!currentDoctor) throw new BadRequestException('Tài khoản hiện tại không có hồ sơ bác sĩ.');
    if (!currentDoctor.departmentId || visit.departmentId !== currentDoctor.departmentId) {
      throw new BadRequestException('Bác sĩ chỉ được tạo chỉ định cho lượt khám trong phòng ban của mình.');
    }
    if (visit.staffId && visit.staffId !== currentDoctor.staffId) {
      throw new BadRequestException('Lượt khám này đã được bác sĩ khác phụ trách.');
    }

    if (([VisitStatus.COMPLETED, VisitStatus.CANCELLED] as string[]).includes(visit.status)) {
      throw new BadRequestException('Không thể tạo thêm chỉ định cho lượt khám đã hoàn tất hoặc đã hủy.');
    }

    if (dto.targetDepartmentId) {
      const department = await this.repo.findOrderDepartment(dto.targetDepartmentId);
      if (!department) throw new NotFoundException('Không tìm thấy phòng ban nhận chỉ định.');
      const isParaclinicalDepartment = ['LABORATORY', 'IMAGING'].includes(department.type);
      if (department.status !== 'ACTIVE' || !department.canReceiveOrders || !isParaclinicalDepartment) {
        throw new BadRequestException('Chỉ được chỉ định tới phòng xét nghiệm hoặc chẩn đoán hình ảnh đang nhận chỉ định.');
      }
    }

    const result = await this.repo.createOrderWithVisitTransition({
      visitId: visit.id,
      patientId: visit.patientId,
      doctorId: currentDoctor.doctorId,
      staffId: currentDoctor.staffId,
      targetDepartmentId: dto.targetDepartmentId || null,
      orderType: dto.orderType.trim(),
      priority: dto.priority?.trim() || 'NORMAL',
      clinicalNote: dto.clinicalNote?.trim() || undefined,
    });

    try {
      const order = result as any;
      if (order && order.targetDepartmentId) {
        const managers = await this.prisma.staffProfile.findMany({
          where: {
            departmentId: order.targetDepartmentId,
            user: {
              role: 'LAB_MANAGER',
              status: 'ACTIVE',
            },
          },
          select: {
            userId: true,
          },
        });

        for (const manager of managers) {
          await this.notificationService.createNotification(
            manager.userId,
            'Chỉ định cận lâm sàng mới',
            `Có chỉ định ${order.orderType} mới (Mã: ${order.orderCode}) cho bệnh nhân ${order.patient?.fullName || 'N/A'}.`,
          );
        }
      }
    } catch (err) {
      console.error('Failed to send medical order notifications:', err);
    }

    return result;
  }
}
