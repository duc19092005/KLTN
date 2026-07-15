import { Module } from '@nestjs/common';
import { PrismaModule } from '../../infrastructure/prisma/prisma.module';
import { AuditModule } from '../../infrastructure/audit/audit.module';
import { PatientController } from './controllers/patient.controller';
import { PatientVerifyController } from './controllers/patient-verify.controller';
import { PatientService } from './services/patient.service';
import { CreatePatientUseCase } from './application/use-cases/create-patient.use-case';
import { ListPatientsUseCase } from './application/use-cases/list-patients.use-case';
import { GetPatientUseCase } from './application/use-cases/get-patient.use-case';
import { VerifyPatientPublicUseCase } from './application/use-cases/verify-patient-public.use-case';
import { PATIENT_REPOSITORY } from './application/ports/patient.repository.port';
import { PATIENT_INTEGRITY_ANCHOR } from './application/ports/patient-integrity-anchor.port';
import { PrismaPatientRepository } from './infrastructure/prisma/prisma-patient.repository';
import { AuditPatientIntegrityAnchor } from './infrastructure/adapters/audit-patient-integrity.anchor';

@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [PatientController, PatientVerifyController],
  providers: [
    PatientService,
    CreatePatientUseCase,
    ListPatientsUseCase,
    GetPatientUseCase,
    VerifyPatientPublicUseCase,
    { provide: PATIENT_REPOSITORY, useClass: PrismaPatientRepository },
    { provide: PATIENT_INTEGRITY_ANCHOR, useClass: AuditPatientIntegrityAnchor },
  ],
  exports: [PatientService, VerifyPatientPublicUseCase],
})
export class PatientModule {}
