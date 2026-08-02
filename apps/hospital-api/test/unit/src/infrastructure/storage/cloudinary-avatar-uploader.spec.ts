import { BadRequestException } from '@nestjs/common';
import { uploadAvatarToCloudinary } from '../../../../../src/infrastructure/storage/cloudinary-avatar-uploader';

describe('Cloudinary avatar uploader functional scenarios', () => {
  const originalEnv = { ...process.env };
  const originalFetch = global.fetch;

  afterEach(() => {
    process.env = { ...originalEnv };
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it.each([
    ['avatar.jpg', 'image/jpeg'],
    ['avatar.png', 'image/png'],
    ['avatar.webp', 'image/webp'],
  ])('[TC3.09] uploads a valid %s image and returns its secure avatar URL', async (originalname, mimetype) => {
    process.env.CLOUDINARY_CLOUD_NAME = 'functional-cloud';
    process.env.CLOUDINARY_API_KEY = 'functional-key';
    process.env.CLOUDINARY_API_SECRET = 'functional-secret';
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: jest.fn().mockResolvedValue(JSON.stringify({ secure_url: `https://res.cloudinary.com/functional/${originalname}` })),
    } as never);

    await expect(uploadAvatarToCloudinary({ buffer: Buffer.from('image'), originalname, mimetype, size: 5 }))
      .resolves.toBe(`https://res.cloudinary.com/functional/${originalname}`);
    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.cloudinary.com/v1_1/functional-cloud/image/upload',
      expect.objectContaining({ method: 'POST', body: expect.any(FormData) }),
    );
  });

  it('[TC3.10] rejects avatar upload when storage configuration is invalid without making a network request', async () => {
    delete process.env.CLOUDINARY_CLOUD_NAME;
    delete process.env.CLOUDINARY_API_KEY;
    delete process.env.CLOUDINARY_API_SECRET;
    global.fetch = jest.fn();

    await expect(uploadAvatarToCloudinary({
      buffer: Buffer.from('invalid'), originalname: 'avatar.exe', mimetype: 'application/x-msdownload', size: 6,
    })).rejects.toThrow(BadRequestException);
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
