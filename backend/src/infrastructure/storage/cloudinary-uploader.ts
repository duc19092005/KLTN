import { BadRequestException } from '@nestjs/common';
import { createHash } from 'crypto';

export async function uploadAvatarToCloudinary(file: {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
}): Promise<string> {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  const uploadPreset = process.env.CLOUDINARY_UPLOAD_PRESET;

  if (!cloudName || !apiKey || !apiSecret) {
    throw new BadRequestException('Chưa cấu hình upload Cloudinary trong môi trường.');
  }

  const timestamp = Math.floor(Date.now() / 1000).toString();
  const folder = 'avatars';
  const publicId = `avatar-${Date.now()}-${Math.round(Math.random() * 1e9)}`;
  const resourceType = 'image';

  // We sign parameters for security. For avatars, we want public access,
  // so we don't set `type: 'authenticated'`. By default it is public.
  const paramsToSign: Record<string, string> = {
    folder,
    public_id: publicId,
    timestamp,
  };
  if (uploadPreset) {
    paramsToSign.upload_preset = uploadPreset;
  }

  // Generate signature
  const payload = Object.keys(paramsToSign)
    .sort()
    .map((key) => `${key}=${paramsToSign[key]}`)
    .join('&');
  const signature = createHash('sha1')
    .update(`${payload}${apiSecret}`)
    .digest('hex');

  const form = new FormData();
  // Node's Buffer needs to be converted or passed as Blob
  const fileBuffer = file.buffer.buffer.slice(
    file.buffer.byteOffset,
    file.buffer.byteOffset + file.buffer.byteLength
  ) as ArrayBuffer;

  form.append('file', new Blob([fileBuffer], { type: file.mimetype }), file.originalname);
  form.append('api_key', apiKey);
  form.append('timestamp', timestamp);
  form.append('folder', folder);
  form.append('public_id', publicId);
  form.append('signature', signature);
  if (uploadPreset) {
    form.append('upload_preset', uploadPreset);
  }

  try {
    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`,
      {
        method: 'POST',
        body: form,
      }
    );

    const bodyText = await response.text();
    let body: any;
    try {
      body = JSON.parse(bodyText);
    } catch {
      body = undefined;
    }

    if (!response.ok) {
      throw new BadRequestException(
        `Tải ảnh lên Cloudinary thất bại (${response.status}): ${body?.error?.message || bodyText}`
      );
    }

    return body.secure_url;
  } catch (error: any) {
    if (error instanceof BadRequestException) throw error;
    throw new BadRequestException(`Lỗi khi kết nối tới Cloudinary: ${error.message}`);
  }
}
