import { Injectable } from '@nestjs/common';
import { MedicalSpecialty } from '@prisma/client';
import { AuthUser } from '../../common/types/auth-user.type';
import { CheckInAppointmentDto, CreateAppointmentDto, CreatePatientProfileFromPortalDto } from './patient-booking.dto';
import { CreatePatientProfileUseCase } from './application/use-cases/create-patient-profile.use-case';
import { CreateAppointmentUseCase } from './application/use-cases/create-appointment.use-case';
import { CancelAppointmentUseCase } from './application/use-cases/cancel-appointment.use-case';
import { CheckInAppointmentUseCase } from './application/use-cases/checkin-appointment.use-case';
import { PatientPortalQueries } from './application/queries/patient-portal.queries';

@Injectable()
export class PatientPortalService {
  constructor(
    private readonly queries: PatientPortalQueries,
    private readonly createProfileUseCase: CreatePatientProfileUseCase,
    private readonly createAppointmentUseCase: CreateAppointmentUseCase,
    private readonly cancelAppointmentUseCase: CancelAppointmentUseCase,
    private readonly checkInAppointmentUseCase: CheckInAppointmentUseCase,
  ) {}

  async getProfiles(userId: string) {
    return this.queries.getProfiles(userId);
  }

  async createProfile(userId: string, dto: CreatePatientProfileFromPortalDto) {
    return this.createProfileUseCase.execute(userId, dto);
  }

  async getProfile(userId: string, patientId: string) {
    return this.queries.getProfile(userId, patientId);
  }

  async getVisits(userId: string, patientId: string) {
    return this.queries.getVisits(userId, patientId);
  }

  async getVisitDetail(userId: string, patientId: string, visitId: string) {
    return this.queries.getVisitDetail(userId, patientId, visitId);
  }

  async getResultFileDownloadUrl(userId: string, patientId: string, fileId: string) {
    return this.queries.getResultFileDownloadUrl(userId, patientId, fileId);
  }

  async getBookableSpecialties() {
    return this.queries.getBookableSpecialties();
  }

  async getSpecialtyDoctors(specialty: MedicalSpecialty) {
    return this.queries.getSpecialtyDoctors(specialty);
  }

  async getDoctorSlots(doctorId: string, dateInput: string) {
    return this.queries.getDoctorSlots(doctorId, dateInput);
  }

  async createAppointment(userId: string, dto: CreateAppointmentDto) {
    return this.createAppointmentUseCase.execute(userId, dto);
  }

  async getAppointments(userId: string, patientId?: string) {
    return this.queries.getAppointments(userId, patientId);
  }

  async getAppointmentQr(userId: string, appointmentId: string) {
    return this.queries.getAppointmentQr(userId, appointmentId);
  }

  async cancelAppointment(userId: string, appointmentId: string) {
    return this.cancelAppointmentUseCase.execute(userId, appointmentId);
  }

  async verifyAppointmentQr(qrPayload: string) {
    return this.queries.verifyAppointmentQr(qrPayload);
  }

  async checkInAppointment(dto: CheckInAppointmentDto, user: AuthUser) {
    return this.checkInAppointmentUseCase.execute(dto, user);
  }
}