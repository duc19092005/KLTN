import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { MedicalOrderStatus } from '@prisma/client';
import {
  MEDICAL_RESULT_STORAGE,
  MedicalResultStoragePort,
  UploadedResultFileInput,
} from '../ports/medical-result-storage.port';
import { MEDICAL_ORDER_REPOSITORY, MedicalOrderRepositoryPort } from '../ports/medical-order.repository.port';

/**
 * Uploads result files (multipart) to private S3 storage and returns
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

    const upperType = order.orderType.toUpperCase();
    const isLabOrMri =
      upperType.includes('LAB') ||
      upperType.includes('MÁU') ||
      upperType.includes('BLOOD') ||
      upperType.includes('XÉT NGHIỆM') ||
      upperType.includes('MRI') ||
      upperType.includes('CỘNG HƯỞNG TỪ');

    const isOnlyImage =
      upperType.includes('XRAY') ||
      upperType.includes('X-QUANG') ||
      upperType.includes('X QUANG') ||
      upperType.includes('CT') ||
      upperType.includes('CẮT LỚP') ||
      upperType.includes('SIÊU ÂM') ||
      upperType.includes('ULTRASOUND');

    const isOnlyPdf =
      upperType.includes('PDF') ||
      upperType.includes('ECG') ||
      upperType.includes('ĐIỆN TÂM ĐỒ') ||
      upperType.includes('BÁO CÁO') ||
      upperType.includes('REPORT');

    for (const file of files) {
      const isPdf = file.mimetype === 'application/pdf';

      if (isLabOrMri) {
        // Allow both
      } else if (isOnlyImage) {
        if (isPdf) {
          throw new BadRequestException('Chỉ chấp nhận file hình ảnh cho chỉ định này.');
        }
      } else if (isOnlyPdf) {
        if (!isPdf) {
          throw new BadRequestException('Chỉ chấp nhận file PDF cho chỉ định này.');
        }
      }
    }

    return this.storage.uploadResultFiles(orderId, files);
  }
}
