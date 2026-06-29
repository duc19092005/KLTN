import { Injectable } from '@nestjs/common';
import { S3StorageService } from '../../../../infrastructure/storage/s3-storage.service';
import { AiImageAttachment } from '../../application/ports/ai-provider-gateway.port';
import { MedicalImageAttachmentPort } from '../../application/ports/medical-image-attachment.port';

type ResultFileForAi = {
  fileName?: string | null;
  originalName?: string | null;
  mimeType?: string | null;
  size?: number | null;
  url?: string | null;
  storageProvider?: string | null;
  bucket?: string | null;
  objectKey?: string | null;
};

type VisitWithResultFiles = {
  medicalOrders?: Array<{
    orderType?: string | null;
    results?: Array<{ files?: ResultFileForAi[] }>;
  }>;
};

@Injectable()
export class S3MedicalImageAttachmentAdapter implements MedicalImageAttachmentPort {
  constructor(private readonly s3: S3StorageService) {}

  async collectImageAttachments(visit: VisitWithResultFiles): Promise<AiImageAttachment[]> {
    const MAX_IMAGES = 6;
    const MAX_BYTES = 8 * 1024 * 1024;
    const attachments: AiImageAttachment[] = [];

    for (const order of visit.medicalOrders || []) {
      for (const result of order.results || []) {
        for (const file of result.files || []) {
          if (attachments.length >= MAX_IMAGES) return attachments;
          if (!this.isAnalyzableImage(file.mimeType)) continue;
          if (file.size && file.size > MAX_BYTES) continue;

          const base64 = await this.downloadResultImageAsBase64(file, MAX_BYTES);
          if (base64) {
            attachments.push({
              mimeType: file.mimeType || 'image/jpeg',
              base64,
              label: `${order.orderType || 'Medical image'} - ${file.originalName || file.fileName || 'attachment'}`,
            });
          }
        }
      }
    }

    return attachments;
  }

  private isAnalyzableImage(mimeType?: string | null) {
    return Boolean(mimeType && mimeType.startsWith('image/'));
  }

  private async downloadResultImageAsBase64(file: ResultFileForAi, maxBytes: number): Promise<string | null> {
    try {
      const buffer = await this.downloadResultImage(file);
      if (!buffer || buffer.byteLength > maxBytes) return null;
      return buffer.toString('base64');
    } catch {
      return null;
    }
  }

  private async downloadResultImage(file: ResultFileForAi): Promise<Buffer | null> {
    if ((file.storageProvider || '').toUpperCase() === 'S3') {
      return this.s3.downloadObjectBuffer(file.bucket, file.objectKey || file.fileName);
    }

    if (!file.url) return null;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20_000);
    try {
      const response = await fetch(file.url, { signal: controller.signal });
      if (!response.ok) return null;
      return Buffer.from(await response.arrayBuffer());
    } finally {
      clearTimeout(timeout);
    }
  }
}
