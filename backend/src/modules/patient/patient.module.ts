import { Module } from '@nestjs/common';
import { PrismaModule } from '../../infrastructure/prisma/prisma.module';
import { PatientController } from './controllers/patient.controller';
import { PatientService } from './services/patient.service';
import { CreatePatientUseCase } from './application/use-cases/create-patient.use-case';
import { ListPatientsUseCase } from './application/use-cases/list-patients.use-case';
import { GetPatientUseCase } from './application/use-cases/get-patient.use-case';
import { PATIENT_REPOSITORY } from './application/ports/patient.repository.port';
import { PrismaPatientRepository } from './infrastructure/prisma/prisma-patient.repository';

@Module({
  imports: [PrismaModule],
  controllers: [PatientController],
  providers: [
    PatientService,
    CreatePatientUseCase,
    ListPatientsUseCase,
    GetPatientUseCase,
    { provide: PATIENT_REPOSITORY, useClass: PrismaPatientRepository },
  ],
  exports: [PatientService],
})
export class PatientModule {}
