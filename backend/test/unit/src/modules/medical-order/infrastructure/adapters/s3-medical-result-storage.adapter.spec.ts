import { BadRequestException } from '@nestjs/common';
import { S3MedicalResultStorageAdapter } from '../../../../../../../src/modules/medical-order/infrastructure/adapters/s3-medical-result-storage.adapter';

describe('S3MedicalResultStorageAdapter', () => {
  function makeAdapter() {
    const s3 = {
      uploadObject: jest.fn().mockResolvedValue({
        storageProvider: 'S3',
        bucket: 'private-bucket',
        objectKey: 'medical-results/order/order-1/file.pdf',
        fileName: 'medical-results/order/order-1/file.pdf',
        originalName: 'file.pdf',
        mimeType: 'application/pdf',
        size: 1234,
        sha256: 'sha-256',
        etag: '"etag"',
      }),
      createPresignedDownloadUrl: jest.fn().mockResolvedValue({
        url: 'https://signed.example/file.pdf',
        expiresAt: '2026-06-19T12:05:00.000Z',
      }),
      getPresignedTtlSeconds: jest.fn().mockReturnValue(300),
    };
    return { adapter: new S3MedicalResultStorageAdapter(s3 as any), s3 };
  }

  it('uploads allowed result files and returns S3 metadata', async () => {
    const { adapter, s3 } = makeAdapter();

    const [stored] = await adapter.uploadResultFiles('order-1', [
      { buffer: Buffer.from('pdf'), originalname: 'file.pdf', mimetype: 'application/pdf', size: 1234 },
    ]);

    expect(s3.uploadObject).toHaveBeenCalledWith(expect.objectContaining({
      keyPrefix: 'medical-results/order/order-1',
      originalName: 'file.pdf',
      mimeType: 'application/pdf',
    }));
    expect(stored).toMatchObject({
      storageProvider: 'S3',
      bucket: 'private-bucket',
      objectKey: 'medical-results/order/order-1/file.pdf',
      sha256: 'sha-256',
      etag: '"etag"',
      url: null,
    });
  });

  it('rejects unsupported MIME types before uploading', async () => {
    const { adapter, s3 } = makeAdapter();

    await expect(
      adapter.uploadResultFiles('order-1', [
        { buffer: Buffer.from('exe'), originalname: 'tool.exe', mimetype: 'application/x-msdownload', size: 10 },
      ]),
    ).rejects.toThrow(BadRequestException);
    expect(s3.uploadObject).not.toHaveBeenCalled();
  });

  it('creates S3 signed download URLs with storage metadata', async () => {
    const { adapter, s3 } = makeAdapter();

    const signed = await adapter.buildSignedDownloadUrl({
      fileName: 'medical-results/order/order-1/file.pdf',
      originalName: 'file.pdf',
      mimeType: 'application/pdf',
      storageProvider: 'S3',
      bucket: 'private-bucket',
      objectKey: 'medical-results/order/order-1/file.pdf',
    });

    expect(s3.createPresignedDownloadUrl).toHaveBeenCalledWith(expect.objectContaining({
      bucket: 'private-bucket',
      objectKey: 'medical-results/order/order-1/file.pdf',
      originalName: 'file.pdf',
      mimeType: 'application/pdf',
    }));
    expect(signed).toEqual({
      url: 'https://signed.example/file.pdf',
      originalName: 'file.pdf',
      expiresAt: '2026-06-19T12:05:00.000Z',
    });
  });

  it('keeps legacy provider URLs readable when storageProvider is not S3', async () => {
    const { adapter } = makeAdapter();

    const signed = await adapter.buildSignedDownloadUrl({
      fileName: 'legacy-id',
      originalName: 'old.pdf',
      mimeType: 'application/pdf',
      storageProvider: 'CLOUDINARY',
      url: 'https://legacy.example/old.pdf',
    });

    expect(signed).toMatchObject({
      url: 'https://legacy.example/old.pdf',
      originalName: 'old.pdf',
    });
  });
});
