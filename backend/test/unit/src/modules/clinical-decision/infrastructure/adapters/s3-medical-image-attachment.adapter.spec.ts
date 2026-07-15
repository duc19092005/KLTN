import { S3MedicalImageAttachmentAdapter } from '../../../../../../../src/modules/clinical-decision/infrastructure/adapters/s3-medical-image-attachment.adapter';

describe('S3MedicalImageAttachmentAdapter', () => {
  function makeAdapter() {
    const s3 = {
      downloadObjectBuffer: jest.fn().mockResolvedValue(Buffer.from('image-bytes')),
    };
    return { adapter: new S3MedicalImageAttachmentAdapter(s3 as any), s3 };
  }

  it('downloads S3 image result files and encodes them for AI input', async () => {
    const { adapter, s3 } = makeAdapter();

    const attachments = await adapter.collectImageAttachments({
      medicalOrders: [
        {
          orderType: 'XRAY',
          results: [
            {
              files: [
                {
                  fileName: 'medical-results/order/order-1/xray.png',
                  originalName: 'xray.png',
                  mimeType: 'image/png',
                  size: 1024,
                  storageProvider: 'S3',
                  bucket: 'private-bucket',
                  objectKey: 'medical-results/order/order-1/xray.png',
                },
              ],
            },
          ],
        },
      ],
    });

    expect(s3.downloadObjectBuffer).toHaveBeenCalledWith('private-bucket', 'medical-results/order/order-1/xray.png');
    expect(attachments).toEqual([
      {
        mimeType: 'image/png',
        base64: Buffer.from('image-bytes').toString('base64'),
        label: 'XRAY - xray.png',
      },
    ]);
  });

  it('skips PDFs and non-image attachments', async () => {
    const { adapter, s3 } = makeAdapter();

    const attachments = await adapter.collectImageAttachments({
      medicalOrders: [
        {
          orderType: 'LAB_TEST',
          results: [
            {
              files: [
                { originalName: 'report.pdf', mimeType: 'application/pdf', storageProvider: 'S3', objectKey: 'report.pdf' },
                { originalName: 'note.txt', mimeType: 'text/plain', storageProvider: 'S3', objectKey: 'note.txt' },
              ],
            },
          ],
        },
      ],
    });

    expect(attachments).toEqual([]);
    expect(s3.downloadObjectBuffer).not.toHaveBeenCalled();
  });
});
