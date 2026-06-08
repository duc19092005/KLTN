import { Injectable } from '@nestjs/common';
import { MedicalOrderStatus } from '@prisma/client';
import { AuthUser } from '../../../common/types/auth-user.type';
import { CreateMedicalOrderDto, CreateMedicalResultDto, MedicalOrderQueryDto } from '../dto/medical-order.dto';
import { CreateMedicalOrderUseCase } from '../application/use-cases/create-medical-order.use-case';
import { ListMedicalOrdersUseCase } from '../application/use-cases/list-medical-orders.use-case';
import { UpdateMedicalOrderStatusUseCase } from '../application/use-cases/update-medical-order-status.use-case';
import { CreateMedicalResultUseCase } from '../application/use-cases/create-medical-result.use-case';
import { MapUploadedResultFilesUseCase } from '../application/use-cases/map-uploaded-result-files.use-case';
import { GetResultFileDownloadUrlUseCase } from '../application/use-cases/get-result-file-download-url.use-case';
import { UploadedResultFileInput } from '../application/ports/medical-result-storage.port';

/**
 * Facade preserving the controller-facing API. Each method delegates to a
 * single use case; no business logic lives here (Clean Architecture refactor).
 */
@Injectable()
export class MedicalOrderService {
  constructor(
    private readonly createOrderUseCase: CreateMedicalOrderUseCase,
    private readonly listOrdersUseCase: ListMedicalOrdersUseCase,
    private readonly updateStatusUseCase: UpdateMedicalOrderStatusUseCase,
    private readonly createResultUseCase: CreateMedicalResultUseCase,
    private readonly mapUploadedFilesUseCase: MapUploadedResultFilesUseCase,
    private readonly getResultFileDownloadUrlUseCase: GetResultFileDownloadUrlUseCase,
  ) {}

  create(dto: CreateMedicalOrderDto, doctorUserId: string) {
    return this.createOrderUseCase.execute(dto, doctorUserId);
  }

  findAll(query: MedicalOrderQueryDto, user: AuthUser) {
    return this.listOrdersUseCase.execute(query, user);
  }

  updateStatus(id: string, status: MedicalOrderStatus, user: AuthUser, demoMode = false) {
    return this.updateStatusUseCase.execute(id, status, user, demoMode);
  }

  createResult(orderId: string, dto: CreateMedicalResultDto, user: AuthUser, demoMode = false) {
    return this.createResultUseCase.execute(orderId, dto, user, demoMode);
  }

  mapUploadedResultFiles(orderId: string, files: UploadedResultFileInput[]) {
    return this.mapUploadedFilesUseCase.execute(orderId, files);
  }

  getResultFileDownloadUrl(fileId: string, user: AuthUser) {
    return this.getResultFileDownloadUrlUseCase.execute(fileId, user);
  }
}
