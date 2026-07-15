import { BadRequestException, Injectable } from '@nestjs/common';
import { S3StorageService } from '../../../../infrastructure/storage/s3-storage.service';
import {
  MedicalResultStoragePort,
  SignableResultFile,
  SignedDownloadUrl,
  StoredResultFile,
  UploadedResultFileInput,
} from '../../application/ports/medical-result-storage.port';

const ALLOWED_RESULT_MIME_TYPES = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp']);

@Injectable()
export class S3MedicalResultStorageAdapter implements MedicalResultStoragePort {
  constructor(private readonly s3: S3StorageService) {}

  async uploadResultFiles(orderId: string, files: UploadedResultFileInput[]): Promise<StoredResultFile[]> {
    return Promise.all(
      files.map(async (file) => {
        if (!ALLOWED_RESULT_MIME_TYPES.has(file.mimetype)) {
          throw new BadRequestException('Chỉ chấp nhận PDF, JPG, PNG hoặc WEBP cho file kết quả.');
        }

        const stored = await this.s3.uploadObject({
          buffer: file.buffer,
          originalName: file.originalname,
          mimeType: file.mimetype,
          size: file.size,
          keyPrefix: `medical-results/order/${orderId}`,
          metadata: { orderid: orderId },
        });

        return {
          fileName: stored.fileName,
          originalName: stored.originalName,
          mimeType: stored.mimeType,
          size: stored.size,
          url: null,
          storageProvider: stored.storageProvider,
          bucket: stored.bucket,
          objectKey: stored.objectKey,
          sha256: stored.sha256,
          etag: stored.etag,
        };
      }),
    );
  }

  async buildSignedDownloadUrl(file: SignableResultFile): Promise<SignedDownloadUrl> {
    if ((file.storageProvider || '').toUpperCase() !== 'S3') {
      return this.buildLegacyDownloadUrl(file);
    }

    const signed = await this.s3.createPresignedDownloadUrl({
      bucket: file.bucket,
      objectKey: file.objectKey || file.fileName,
      originalName: file.originalName,
      mimeType: file.mimeType,
    });

    return { ...signed, originalName: file.originalName };
  }

  private buildLegacyDownloadUrl(file: SignableResultFile): SignedDownloadUrl {
    if (!file.url) {
      throw new BadRequestException('File legacy không có URL để tải xuống.');
    }

    const expiresIn = this.s3.getPresignedTtlSeconds();
    return {
      url: file.url,
      originalName: file.originalName,
      expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
    };
  }
}
