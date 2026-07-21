import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthUser } from '../../common/types/auth-user.type';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PatientPortalService } from './patient-portal.service';
import {
  AppointmentListQueryDto,
  AppointmentSlotQueryDto,
  CheckInAppointmentDto,
  CreateAppointmentDto,
  CreatePatientProfileFromPortalDto,
  VerifyAppointmentQrDto,
} from './patient-booking.dto';

@ApiTags('Patient Portal')
@ApiBearerAuth()
@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class PatientPortalController {
  constructor(private readonly patientPortalService: PatientPortalService) {}

  @Roles('PATIENT')
  @Get('patient/me/profiles')
  profiles(@CurrentUser() user: AuthUser) {
    return this.patientPortalService.getProfiles(user.sub);
  }

  @Roles('PATIENT')
  @Post('patient/me/profiles')
  createProfile(@CurrentUser() user: AuthUser, @Body() dto: CreatePatientProfileFromPortalDto) {
    return this.patientPortalService.createProfile(user.sub, dto);
  }

  @Roles('PATIENT')
  @Get('patient/me/profiles/:patientId')
  profile(@CurrentUser() user: AuthUser, @Param('patientId') patientId: string) {
    return this.patientPortalService.getProfile(user.sub, patientId);
  }

  @Roles('PATIENT')
  @Get('patient/me/profiles/:patientId/visits')
  visits(@CurrentUser() user: AuthUser, @Param('patientId') patientId: string) {
    return this.patientPortalService.getVisits(user.sub, patientId);
  }

  @Roles('PATIENT')
  @Get('patient/me/profiles/:patientId/visits/:visitId')
  visitDetail(
    @CurrentUser() user: AuthUser,
    @Param('patientId') patientId: string,
    @Param('visitId') visitId: string,
  ) {
    return this.patientPortalService.getVisitDetail(user.sub, patientId, visitId);
  }

  @Roles('PATIENT')
  @Get('patient/me/profiles/:patientId/files/:fileId/download')
  fileDownloadUrl(
    @CurrentUser() user: AuthUser,
    @Param('patientId') patientId: string,
    @Param('fileId') fileId: string,
  ) {
    return this.patientPortalService.getResultFileDownloadUrl(user.sub, patientId, fileId);
  }

  @Roles('PATIENT')
  @Get('patient/me/booking/specialties')
  bookableSpecialties() {
    return this.patientPortalService.getBookableSpecialties();
  }

  @Roles('PATIENT')
  @Get('patient/me/booking/specialties/:specialty/doctors')
  specialtyDoctors(@Param('specialty') specialty: string) {
    return this.patientPortalService.getSpecialtyDoctors(specialty as any);
  }

  @Roles('PATIENT')
  @Get('patient/me/booking/doctors/:doctorId/slots')
  doctorSlots(@Param('doctorId') doctorId: string, @Query() query: AppointmentSlotQueryDto) {
    return this.patientPortalService.getDoctorSlots(doctorId, query.date);
  }

  @Roles('PATIENT')
  @Post('patient/me/appointments')
  createAppointment(@CurrentUser() user: AuthUser, @Body() dto: CreateAppointmentDto) {
    return this.patientPortalService.createAppointment(user.sub, dto);
  }

  @Roles('PATIENT')
  @Get('patient/me/appointments')
  appointments(@CurrentUser() user: AuthUser, @Query() query: AppointmentListQueryDto) {
    return this.patientPortalService.getAppointments(user.sub, query.patientId);
  }

  @Roles('PATIENT')
  @Get('patient/me/appointments/:appointmentId/qr')
  appointmentQr(@CurrentUser() user: AuthUser, @Param('appointmentId') appointmentId: string) {
    return this.patientPortalService.getAppointmentQr(user.sub, appointmentId);
  }

  @Roles('PATIENT')
  @Delete('patient/me/appointments/:appointmentId')
  cancelAppointment(@CurrentUser() user: AuthUser, @Param('appointmentId') appointmentId: string) {
    return this.patientPortalService.cancelAppointment(user.sub, appointmentId);
  }

  @Roles('ADMIN', 'RECEPTIONIST')
  @Post('appointments/qr/verify')
  verifyAppointmentQr(@Body() dto: VerifyAppointmentQrDto) {
    return this.patientPortalService.verifyAppointmentQr(dto.qrPayload);
  }

  @Roles('ADMIN', 'RECEPTIONIST')
  @Post('appointments/check-in')
  checkInAppointment(@CurrentUser() user: AuthUser, @Body() dto: CheckInAppointmentDto) {
    return this.patientPortalService.checkInAppointment(dto, user);
  }
}
