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
    if (!files.length) throw new BadRequestException('Vui lòng tải lên ít nhất một file PDF hoặc hình ảnh.');
    const order = await this.repo.findOrderForManage(orderId);
    if (!order) throw new NotFoundException('Không tìm thấy phiếu chỉ định.');
    if (([MedicalOrderStatus.RESULT_READY, MedicalOrderStatus.CANCELLED] as MedicalOrderStatus[]).includes(order.status)) {
      throw new BadRequestException('Không thể tải file cho phiếu đã sẵn sàng, hoàn tất hoặc đã hủy.');
    }

    return this.storage.uploadResultFiles(orderId, files);
  }
}
