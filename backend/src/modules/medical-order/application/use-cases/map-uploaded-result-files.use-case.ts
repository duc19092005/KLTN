import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { MedicalOrderStatus } from '@prisma/client';
import {
  MEDICAL_RESULT_STORAGE,
  MedicalResultStoragePort,
  UploadedResultFileInput,
} from '../ports/medical-result-storage.port';
import { MEDICAL_ORDER_REPOSITORY, MedicalOrderRepositoryPort } from '../ports/medical-order.repository.port';

/**
 * Uploads result files (multipart) to private Cloudinary storage and returns
 * descriptors for the subsequent createResult call. Validation copied verbatim
 * from the former MedicalOrderService.mapUploadedResultFiles().
 */
@Injectable()
export class MapUploadedResultFilesUseCase {
  constructor(
    @Inject(MEDICAL_ORDER_REPOSITORY) private readonly repo: MedicalOrderRepositoryPort,
    @Inject(MEDICAL_RESULT_STORAGE) private readonly storage: MedicalResultStoragePort,
  ) {}

  async execute(orderId: string, files: UploadedResultFileInput[]) {
    if (!files.length) throw new BadRequestException('Please upload at least one PDF/image file');
    const order = await this.repo.findOrderForManage(orderId);
    if (!order) throw new NotFoundException('Medical order not found');
    if (([MedicalOrderStatus.RESULT_READY, MedicalOrderStatus.CANCELLED] as MedicalOrderStatus[]).includes(order.status)) {
      throw new BadRequestException('Cannot upload files for an order that is already ready/completed/cancelled');
    }

    return this.storage.uploadResultFiles(orderId, files);
  }
}
