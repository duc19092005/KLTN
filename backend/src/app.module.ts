import 'dotenv/config';
import { Module } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { AuthModule } from './modules/auth/auth.module';
import { BlockchainModule } from './infrastructure/blockchain/blockchain.module';
import { AuditModule } from './infrastructure/audit/audit.module';
import { PrismaModule } from './infrastructure/prisma/prisma.module';
import { EncryptionModule } from './modules/encryption/encryption.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DepartmentModule } from './modules/department/department.module';
import { StaffEnterpriseModule } from './modules/staff/staff.module';
import { DoctorModule } from './modules/doctor/doctor.module';
import { ClinicalRoomModule } from './modules/clinical-room/clinical-room.module';
import { PatientModule } from './modules/patient/patient.module';
import { VisitModule } from './modules/visit/visit.module';
import { AiModelModule } from './modules/ai-model/ai-model.module';
import { MedicalOrderModule } from './modules/medical-order/medical-order.module';
import { ClinicalDecisionModule } from './modules/clinical-decision/clinical-decision.module';
import { AuditApiModule } from './modules/audit/audit-api.module';
import { ParaclinicalShiftModule } from './modules/paraclinical-shift/paraclinical-shift.module';
import { BackupModule } from './modules/backup/backup.module';
import { ApiResponseInterceptor } from './common/interceptors/api-response.interceptor';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { StepUpModule } from './common/stepup/stepup.module';

@Module({
  imports: [
    PrismaModule,
    BlockchainModule,
    AuditModule,
    StepUpModule,
    EncryptionModule,
    AuthModule,
    DepartmentModule,
    StaffEnterpriseModule,
    DoctorModule,
    ClinicalRoomModule,
    PatientModule,
    VisitModule,
    AiModelModule,
    MedicalOrderModule,
    ClinicalDecisionModule,
    AuditApiModule,
    ParaclinicalShiftModule,
    BackupModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_INTERCEPTOR, useClass: ApiResponseInterceptor },
    { provide: APP_FILTER, useClass: GlobalExceptionFilter },
  ],
})
export class AppModule {}
