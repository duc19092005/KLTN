import { Module } from '@nestjs/common';
import { PatientPortalController } from './patient-portal.controller';
import { PatientPortalService } from './patient-portal.service';
import { S3MedicalResultStorageAdapter } from '../medical-order/infrastructure/adapters/s3-medical-result-storage.adapter';
import { PatientPortalAccessService } from './application/services/patient-portal-access.service';
import { CreatePatientProfileUseCase } from './application/use-cases/create-patient-profile.use-case';
import { CreateAppointmentUseCase } from './application/use-cases/create-appointment.use-case';
import { CancelAppointmentUseCase } from './application/use-cases/cancel-appointment.use-case';
import { CheckInAppointmentUseCase } from './application/use-cases/checkin-appointment.use-case';
import { PatientPortalQueries } from './application/queries/patient-portal.queries';

@Module({
  controllers: [PatientPortalController],
  providers: [
    PatientPortalAccessService,
    CreatePatientProfileUseCase,
    CreateAppointmentUseCase,
    CancelAppointmentUseCase,
    CheckInAppointmentUseCase,
    PatientPortalQueries,
    PatientPortalService,
    S3MedicalResultStorageAdapter,
  ],
  exports: [
    PatientPortalService,
    CreatePatientProfileUseCase,
    CreateAppointmentUseCase,
    CancelAppointmentUseCase,
    CheckInAppointmentUseCase,
    PatientPortalQueries,
  ],
})
export class PatientPortalModule {}
