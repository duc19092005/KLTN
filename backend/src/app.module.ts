import 'dotenv/config';
import { Module } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { AuthModule } from './modules/auth/auth.module';
import { BlockchainModule } from './infrastructure/blockchain/blockchain.module';
import { PrismaModule } from './infrastructure/prisma/prisma.module';
import { ZkpModule } from './modules/zkp/zkp.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DepartmentModule } from './modules/department/department.module';
import { StaffEnterpriseModule } from './modules/staff/staff.module';
import { DoctorModule } from './modules/doctor/doctor.module';
import { ClinicalRoomModule } from './modules/clinical-room/clinical-room.module';
import { ApiResponseInterceptor } from './common/interceptors/api-response.interceptor';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';

@Module({
  imports: [
    PrismaModule,
    BlockchainModule,
    ZkpModule,
    AuthModule,
    DepartmentModule,
    StaffEnterpriseModule,
    DoctorModule,
    ClinicalRoomModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_INTERCEPTOR, useClass: ApiResponseInterceptor },
    { provide: APP_FILTER, useClass: GlobalExceptionFilter },
  ],
})
export class AppModule {}
