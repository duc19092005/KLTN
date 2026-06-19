import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { createHash, randomUUID } from 'crypto';
import { Readable } from 'stream';

export type S3UploadInput = {
  buffer: Buffer;
  originalName: string;
  mimeType: string;
  size: number;
  keyPrefix: string;
  metadata?: Record<string, string>;
};

export type S3StoredObject = {
  storageProvider: 'S3';
  bucket: string;
  objectKey: string;
  fileName: string;
  originalName: string;
  mimeType: string;
  size: number;
  sha256: string;
  etag: string | null;
};

@Injectable()
export class S3StorageService {
  private readonly client: S3Client;
  private readonly region = process.env.AWS_REGION || 'ap-southeast-1';
  private readonly bucket = process.env.AWS_S3_BUCKET || '';
  private readonly ttlSeconds = Number(process.env.AWS_S3_PRESIGNED_URL_TTL_SECONDS || 300);
  private readonly kmsKeyId = process.env.AWS_S3_KMS_KEY_ID || '';

  constructor() {
    this.client = new S3Client({ region: this.region });
  }

  async uploadObject(input: S3UploadInput): Promise<S3StoredObject> {
    this.assertConfigured();
    const objectKey = this.buildObjectKey(input.keyPrefix, input.originalName);
    const sha256 = createHash('sha256').update(input.buffer).digest('hex');

    const response = await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: objectKey,
        Body: input.buffer,
        ContentLength: input.size,
        ContentType: input.mimeType,
        Metadata: {
          originalname: input.originalName,
          sha256,
          ...(input.metadata || {}),
        },
        ServerSideEncryption: this.kmsKeyId ? 'aws:kms' : 'AES256',
        ...(this.kmsKeyId ? { SSEKMSKeyId: this.kmsKeyId } : {}),
      }),
    );

    return {
      storageProvider: 'S3',
      bucket: this.bucket,
      objectKey,
      fileName: objectKey,
      originalName: input.originalName,
      mimeType: input.mimeType,
      size: input.size,
      sha256,
      etag: response.ETag || null,
    };
  }

  async createPresignedDownloadUrl(input: {
    bucket?: string | null;
    objectKey?: string | null;
    originalName: string;
    mimeType?: string | null;
  }) {
    const bucket = input.bucket || this.bucket;
    if (!bucket || !input.objectKey) throw new BadRequestException('File S3 thiếu bucket hoặc objectKey.');

    const expiresIn = this.getPresignedTtlSeconds();
    const url = await getSignedUrl(
      this.client,
      new GetObjectCommand({
        Bucket: bucket,
        Key: input.objectKey,
        ResponseContentType: input.mimeType || undefined,
        ResponseContentDisposition: this.contentDisposition(input.originalName),
      }),
      { expiresIn },
    );

    return {
      url,
      expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
    };
  }

  async downloadObjectBuffer(bucket: string | null | undefined, objectKey: string | null | undefined): Promise<Buffer> {
    const resolvedBucket = bucket || this.bucket;
    if (!resolvedBucket || !objectKey) throw new BadRequestException('File S3 thiếu bucket hoặc objectKey.');

    const response = await this.client.send(new GetObjectCommand({ Bucket: resolvedBucket, Key: objectKey }));
    if (!response.Body) throw new NotFoundException('Không tìm thấy nội dung file trong S3.');
    return this.streamToBuffer(response.Body);
  }

  async headObject(bucket: string | null | undefined, objectKey: string | null | undefined) {
    const resolvedBucket = bucket || this.bucket;
    if (!resolvedBucket || !objectKey) throw new BadRequestException('File S3 thiếu bucket hoặc objectKey.');
    return this.client.send(new HeadObjectCommand({ Bucket: resolvedBucket, Key: objectKey }));
  }

  getPresignedTtlSeconds() {
    const parsed = Number.isFinite(this.ttlSeconds) && this.ttlSeconds > 0 ? this.ttlSeconds : 300;
    return Math.min(parsed, 3600);
  }

  private assertConfigured() {
    if (!this.bucket) {
      throw new BadRequestException('Chưa cấu hình AWS_S3_BUCKET cho storage S3.');
    }
  }

  private buildObjectKey(prefix: string, originalName: string) {
    const safePrefix = prefix.replace(/^\/+|\/+$/g, '').replace(/[^a-zA-Z0-9/_-]/g, '-');
    const safeName = this.safeFileName(originalName);
    return `${safePrefix}/${randomUUID()}-${safeName}`;
  }

  private safeFileName(name: string) {
    const fallback = 'upload.bin';
    const safe = (name || fallback).replace(/[/\\?%*:|"<>]/g, '-').replace(/\s+/g, '-').slice(0, 120);
    return safe || fallback;
  }

  private contentDisposition(originalName: string) {
    const asciiName = this.safeFileName(originalName).replace(/"/g, '');
    return `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(originalName)}`;
  }

  private async streamToBuffer(body: unknown): Promise<Buffer> {
    if (body instanceof Readable) {
      const chunks: Buffer[] = [];
      for await (const chunk of body) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      return Buffer.concat(chunks);
    }

    if (body && typeof (body as { transformToByteArray?: () => Promise<Uint8Array> }).transformToByteArray === 'function') {
      const bytes = await (body as { transformToByteArray: () => Promise<Uint8Array> }).transformToByteArray();
      return Buffer.from(bytes);
    }

    throw new BadRequestException('Không thể đọc stream file từ S3.');
  }
}
