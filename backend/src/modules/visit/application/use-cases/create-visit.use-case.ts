import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { CreateVisitDto } from '../../dto/visit.dto';
import { VISIT_REPOSITORY, VisitRepositoryPort } from '../ports/visit.repository.port';

/**
 * Intake workflow: validate room/doctor coupling, then create the visit
 * (optionally creating the patient inline) inside the repository transaction.
 * Behavior copied verbatim from the former VisitService.create().
 */
@Injectable()
export class CreateVisitUseCase {
  constructor(@Inject(VISIT_REPOSITORY) private readonly repo: VisitRepositoryPort) {}

  async execute(dto: CreateVisitDto): Promise<unknown> {
    if (!dto.patientId && !dto.patient) throw new BadRequestException('Vui lòng chọn bệnh nhân hoặc nhập thông tin bệnh nhân mới.');

    const room = await this.repo.findRoomWithDoctor(dto.clinicalRoomId);
    if (!room) throw new NotFoundException('Không tìm thấy phòng khám.');

    const doctor = await this.repo.findDoctorProfileById(dto.doctorId);
    if (!doctor) throw new NotFoundException('Không tìm thấy hồ sơ bác sĩ.');

    if (room.doctorId && room.doctorId !== dto.doctorId) {
      throw new BadRequestException('Bác sĩ được chọn không phụ trách phòng khám này.');
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
      clinicalRoomId: dto.clinicalRoomId,
      doctorId: dto.doctorId,
    });
  }
}
