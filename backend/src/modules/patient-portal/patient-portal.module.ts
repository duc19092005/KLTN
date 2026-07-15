import { Module } from '@nestjs/common';
import { PatientPortalController } from './patient-portal.controller';
import { PatientPortalService } from './patient-portal.service';
import { S3MedicalResultStorageAdapter } from '../medical-order/infrastructure/adapters/s3-medical-result-storage.adapter';

@Module({
  controllers: [PatientPortalController],
  providers: [PatientPortalService, S3MedicalResultStorageAdapter],
})
export class PatientPortalModule {}
