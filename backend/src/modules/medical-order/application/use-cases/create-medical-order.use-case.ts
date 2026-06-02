import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { VisitStatus } from '@prisma/client';
import { CreateMedicalOrderDto } from '../../dto/medical-order.dto';
import { MEDICAL_ORDER_REPOSITORY, MedicalOrderRepositoryPort } from '../ports/medical-order.repository.port';

/**
 * Doctor creates a lab/imaging order for their own visit. Validation order and
 * error types copied verbatim from the former MedicalOrderService.create();
 * the order+visit transition stays atomic inside the repository.
 */
@Injectable()
export class CreateMedicalOrderUseCase {
  constructor(@Inject(MEDICAL_ORDER_REPOSITORY) private readonly repo: MedicalOrderRepositoryPort) {}

  async execute(dto: CreateMedicalOrderDto, doctorUserId: string): Promise<unknown> {
    const visit = await this.repo.findVisitForOrder(dto.visitId);
    if (!visit) throw new NotFoundException('Visit not found');

    const currentDoctorId = await this.repo.findDoctorIdByUserId(doctorUserId);
    if (!currentDoctorId) throw new BadRequestException('Current user does not have doctor profile');
    if (visit.doctorId !== currentDoctorId) throw new BadRequestException('Doctor can only order tests for own visit');

    if (([VisitStatus.COMPLETED, VisitStatus.CANCELLED] as string[]).includes(visit.status)) {
      throw new BadRequestException('Cannot create additional medical orders for a completed/cancelled visit');
    }

    if (dto.targetDepartmentId) {
      const exists = await this.repo.departmentExists(dto.targetDepartmentId);
      if (!exists) throw new NotFoundException('Target department not found');
    }

    return this.repo.createOrderWithVisitTransition({
      visitId: visit.id,
      patientId: visit.patientId,
      doctorId: currentDoctorId,
      targetDepartmentId: dto.targetDepartmentId || null,
      orderType: dto.orderType.trim(),
      priority: dto.priority?.trim() || 'NORMAL',
      clinicalNote: dto.clinicalNote?.trim() || undefined,
    });
  }
}
