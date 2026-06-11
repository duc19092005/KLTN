import { BadRequestException, Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import {
  MedicalResultStoragePort,
  SignableResultFile,
  SignedDownloadUrl,
  StoredResultFile,
  UploadedResultFileInput,
} from '../../application/ports/medical-result-storage.port';

type CloudinaryUploadResult = {
  public_id: string;
  secure_url: string;
  resource_type: string;
  format?: string;
};

/**
 * Cloudinary implementation of MedicalResultStoragePort. Logic copied verbatim
 * from the former MedicalOrderService so PHI stays private (authenticated assets)
 * and downloads require a short-lived signature.
 */
@Injectable()
export class CloudinaryMedicalResultStorageAdapter implements MedicalResultStoragePort {
  async uploadResultFiles(orderId: string, files: UploadedResultFileInput[]): Promise<StoredResultFile[]> {
    const uploadedFiles = await Promise.all(files.map((file) => this.uploadFileToCloudinary(file, orderId)));
    return uploadedFiles.map(({ file, cloudinary }) => ({
      fileName: cloudinary.public_id,
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      url: cloudinary.secure_url,
    }));
  }

  buildSignedDownloadUrl(file: SignableResultFile): SignedDownloadUrl {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;
    if (!cloudName || !apiKey || !apiSecret) throw new BadRequestException('Chưa cấu hình Cloudinary.');

    const resourceType = file.mimeType === 'application/pdf' ? 'raw' : 'image';
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
    const url = `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/download?${query}`;

    return { url, originalName: file.originalName, expiresAt: new Date(expiresAt * 1000).toISOString() };
  }

  private extractFileFormat(originalName: string, mimeType: string) {
    const ext = originalName.includes('.') ? originalName.split('.').pop()!.toLowerCase() : '';
    if (ext) return ext;
    const map: Record<string, string> = {
      'application/pdf': 'pdf',
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
    };
    return map[mimeType] || '';
  }

  private uploadFileToCloudinary(
    file: UploadedResultFileInput,
    orderId: string,
  ): Promise<{ file: UploadedResultFileInput; cloudinary: CloudinaryUploadResult }> {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;
    const uploadPreset = process.env.CLOUDINARY_UPLOAD_PRESET;
    if (!cloudName || !apiKey || !apiSecret) {
      throw new BadRequestException('Chưa cấu hình upload Cloudinary.');
    }

    const timestamp = Math.floor(Date.now() / 1000).toString();
    const folder = 'medical-results';
    const publicId = `${orderId}-${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const resourceType = file.mimetype === 'application/pdf' ? 'raw' : 'image';
    // `type: authenticated` makes the asset private: it cannot be fetched from
    // Cloudinary without a valid signature, preventing public exposure of PHI.
    const paramsToSign: Record<string, string> = { folder, public_id: publicId, timestamp, type: 'authenticated' };
    if (uploadPreset) paramsToSign.upload_preset = uploadPreset;
    const signature = this.signCloudinaryParams(paramsToSign, apiSecret);
    const form = new FormData();
    const fileBuffer = file.buffer.buffer.slice(file.buffer.byteOffset, file.buffer.byteOffset + file.buffer.byteLength) as ArrayBuffer;
    form.append('file', new Blob([fileBuffer], { type: file.mimetype }), file.originalname);
    form.append('api_key', apiKey);
    form.append('timestamp', timestamp);
    form.append('folder', folder);
    form.append('public_id', publicId);
    form.append('type', 'authenticated');
    form.append('signature', signature);
    if (uploadPreset) form.append('upload_preset', uploadPreset);

    return fetch(`https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`, {
      method: 'POST',
      body: form,
    }).then(async (response) => {
      const bodyText = await response.text();
      const body = this.tryParseJson(bodyText);
      if (!response.ok) {
        throw new BadRequestException(`Tải file lên Cloudinary thất bại (${response.status}): ${body?.error?.message || bodyText}`);
      }
      return { file, cloudinary: body as CloudinaryUploadResult };
    });
  }

  private signCloudinaryParams(params: Record<string, string>, apiSecret: string) {
    const payload = Object.keys(params)
      .sort()
      .map((key) => `${key}=${params[key]}`)
      .join('&');
    return createHash('sha1').update(`${payload}${apiSecret}`).digest('hex');
  }

  private tryParseJson(value: string) {
    try {
      return JSON.parse(value);
    } catch {
      return undefined;
    }
  }
}
