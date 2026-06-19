import { BadRequestException } from '@nestjs/common';
import { createHash, randomUUID } from 'crypto';

type AvatarUploadFile = {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
};

type CloudinaryUploadResult = {
  secure_url?: string;
  public_id?: string;
  error?: { message?: string };
};

export async function uploadAvatarToCloudinary(file: AvatarUploadFile): Promise<string> {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  const uploadPreset = process.env.CLOUDINARY_UPLOAD_PRESET;
  if (!cloudName || !apiKey || !apiSecret) {
    throw new BadRequestException('Chưa cấu hình Cloudinary cho upload avatar.');
  }

  const timestamp = Math.floor(Date.now() / 1000).toString();
  const folder = 'avatars/staff';
  const publicId = `${Date.now()}-${randomUUID()}`;
  const paramsToSign: Record<string, string> = { folder, public_id: publicId, timestamp };
  if (uploadPreset) paramsToSign.upload_preset = uploadPreset;

  const form = new FormData();
  const fileBuffer = file.buffer.buffer.slice(file.buffer.byteOffset, file.buffer.byteOffset + file.buffer.byteLength) as ArrayBuffer;
  form.append('file', new Blob([fileBuffer], { type: file.mimetype }), file.originalname);
  form.append('api_key', apiKey);
  form.append('timestamp', timestamp);
  form.append('folder', folder);
  form.append('public_id', publicId);
  form.append('signature', signCloudinaryParams(paramsToSign, apiSecret));
  if (uploadPreset) form.append('upload_preset', uploadPreset);

  try {
    const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
      method: 'POST',
      body: form,
    });
    const bodyText = await response.text();
    const body = tryParseJson(bodyText) as CloudinaryUploadResult | undefined;
    if (!response.ok || !body?.secure_url) {
      throw new BadRequestException(`Tải avatar lên Cloudinary thất bại (${response.status}): ${body?.error?.message || bodyText}`);
    }

    return body.secure_url;
  } catch (error) {
    if (error instanceof BadRequestException) throw error;
    const message = error instanceof Error ? error.message : 'unknown error';
    throw new BadRequestException(`Lỗi khi kết nối tới Cloudinary: ${message}`);
  }
}

function signCloudinaryParams(params: Record<string, string>, apiSecret: string) {
  const payload = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join('&');
  return createHash('sha1').update(`${payload}${apiSecret}`).digest('hex');
}

function tryParseJson(value: string) {
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}
