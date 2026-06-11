import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { CreateVisitDto } from '../../dto/visit.dto';
import { VISIT_REPOSITORY, VisitRepositoryPort } from '../ports/visit.repository.port';

/**
 * Intake workflow: reception selects an active examination department, then the
 * repository creates the visit and optional patient inside one transaction.
 */
@Injectable()
export class CreateVisitUseCase {
  constructor(@Inject(VISIT_REPOSITORY) private readonly repo: VisitRepositoryPort) {}

  async execute(dto: CreateVisitDto): Promise<unknown> {
    if (!dto.patientId && !dto.patient) {
      throw new BadRequestException('Vui lòng chọn bệnh nhân hoặc nhập thông tin bệnh nhân mới.');
    }

    const department = await this.repo.findDepartmentForVisit(dto.departmentId);
    if (!department) throw new NotFoundException('Không tìm thấy phòng ban khám.');
    if (department.status !== 'ACTIVE' || department.type !== 'EXAMINATION') {
      throw new BadRequestException('Lễ tân chỉ có thể chọn phòng ban loại phòng khám đang hoạt động.');
    }

    return this.repo.createVisitWithOptionalPatient({
      patientId: dto.patientId,
      patient: dto.patient
        ? {
            fullName: dto.patient.fullName,
            gender: dto.patient.gender,
            birthDate: dto.patient.birthDate,
            citizenId: dto.patient.citizenId,
            phone: dto.patient.phone,
            address: dto.patient.address,
            insuranceNumber: dto.patient.insuranceNumber,
            emergencyContact: dto.patient.emergencyContact,
          }
        : undefined,
      departmentId: dto.departmentId,
    });
  }
}
