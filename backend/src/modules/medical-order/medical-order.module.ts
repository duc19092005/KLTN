import { Module } from '@nestjs/common';
import { MedicalOrderController } from './controllers/medical-order.controller';
import { MedicalOrderService } from './services/medical-order.service';
import { MedicalOrderAccessPolicy } from './application/policies/medical-order-access.policy';
import { CreateMedicalOrderUseCase } from './application/use-cases/create-medical-order.use-case';
import { ListMedicalOrdersUseCase } from './application/use-cases/list-medical-orders.use-case';
import { UpdateMedicalOrderStatusUseCase } from './application/use-cases/update-medical-order-status.use-case';
import { CreateMedicalResultUseCase } from './application/use-cases/create-medical-result.use-case';
import { MapUploadedResultFilesUseCase } from './application/use-cases/map-uploaded-result-files.use-case';
import { GetResultFileDownloadUrlUseCase } from './application/use-cases/get-result-file-download-url.use-case';
import { MEDICAL_ORDER_REPOSITORY } from './application/ports/medical-order.repository.port';
import { MEDICAL_RESULT_STORAGE } from './application/ports/medical-result-storage.port';
import { PrismaMedicalOrderRepository } from './infrastructure/prisma/prisma-medical-order.repository';
import { S3MedicalResultStorageAdapter } from './infrastructure/adapters/s3-medical-result-storage.adapter';

@Module({
  controllers: [MedicalOrderController],
  providers: [
    MedicalOrderService,
    CreateMedicalOrderUseCase,
    ListMedicalOrdersUseCase,
    UpdateMedicalOrderStatusUseCase,
    CreateMedicalResultUseCase,
    MapUploadedResultFilesUseCase,
    GetResultFileDownloadUrlUseCase,
    MedicalOrderAccessPolicy,
    { provide: MEDICAL_ORDER_REPOSITORY, useClass: PrismaMedicalOrderRepository },
    { provide: MEDICAL_RESULT_STORAGE, useClass: S3MedicalResultStorageAdapter },
  ],
  exports: [MedicalOrderService],
})
export class MedicalOrderModule {}
