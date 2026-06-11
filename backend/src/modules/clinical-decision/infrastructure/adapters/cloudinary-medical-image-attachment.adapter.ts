import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import { AiImageAttachment } from '../../application/ports/ai-provider-gateway.port';
import { MedicalImageAttachmentPort } from '../../application/ports/medical-image-attachment.port';

/**
 * Downloads a visit's private medical-result images from Cloudinary and inlines
 * them as base64 for multimodal AI input. Logic copied verbatim from the former
 * ClinicalDecisionService (collectImageAttachments + signed-URL download), with
 * the same count/size caps to protect the provider token budget.
 */
@Injectable()
export class CloudinaryMedicalImageAttachmentAdapter implements MedicalImageAttachmentPort {
  async collectImageAttachments(visit: any): Promise<AiImageAttachment[]> {
    const MAX_IMAGES = 6;
    const MAX_BYTES = 8 * 1024 * 1024;
    const attachments: AiImageAttachment[] = [];

    for (const order of visit.medicalOrders || []) {
      for (const result of order.results || []) {
        for (const file of result.files || []) {
          if (attachments.length >= MAX_IMAGES) return attachments;
          if (!this.isAnalyzableImage(file.mimeType)) continue;
          const base64 = await this.downloadResultImageAsBase64(file, MAX_BYTES);
          if (base64) {
            attachments.push({ mimeType: file.mimeType, base64, label: `${order.orderType} - ${file.originalName}` });
          }
        }
      }
    }
    return attachments;
  }

  private isAnalyzableImage(mimeType?: string | null) {
    return Boolean(mimeType && mimeType.startsWith('image/'));
  }

  private async downloadResultImageAsBase64(file: any, maxBytes: number): Promise<string | null> {
    try {
      const url = this.buildSignedCloudinaryImageUrl(file);
      if (!url) return null;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 20_000);
      try {
        const response = await fetch(url, { signal: controller.signal });
        if (!response.ok) return null;
        const arrayBuffer = await response.arrayBuffer();
        if (arrayBuffer.byteLength > maxBytes) return null;
        return Buffer.from(arrayBuffer).toString('base64');
      } finally {
        clearTimeout(timeout);
      }
    } catch {
      return null;
    }
  }

  // Mirrors the signed-download approach used by MedicalOrderService: result files are stored
  // as `authenticated` (private) Cloudinary assets, so a signed, short-lived URL is required.
  private buildSignedCloudinaryImageUrl(file: any): string | null {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;
    if (!cloudName || !apiKey || !apiSecret || !file.fileName) return null;

    const format = this.extractFileFormat(file.originalName, file.mimeType);
    const timestamp = Math.floor(Date.now() / 1000);
    const expiresAt = timestamp + 300; // 5-minute TTL
    const params: Record<string, string> = {
      expires_at: String(expiresAt),
      public_id: file.fileName,
      timestamp: String(timestamp),
      type: 'authenticated',
    };
    if (format) params.format = format;

    const signature = this.signCloudinaryParams(params, apiSecret);
    const query = new URLSearchParams({ ...params, signature, api_key: apiKey }).toString();
    return `https://api.cloudinary.com/v1_1/${cloudName}/image/download?${query}`;
  }

  private extractFileFormat(originalName?: string, mimeType?: string) {
    const ext = originalName?.includes('.') ? originalName.split('.').pop()!.toLowerCase() : '';
    if (ext) return ext;
    const map: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
    };
    return (mimeType && map[mimeType]) || '';
  }

  private signCloudinaryParams(params: Record<string, string>, apiSecret: string) {
    const payload = Object.keys(params)
      .sort()
      .map((key) => `${key}=${params[key]}`)
      .join('&');
    return createHash('sha1').update(`${payload}${apiSecret}`).digest('hex');
  }
}
