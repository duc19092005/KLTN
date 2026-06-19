import { BadRequestException, Controller, Get, Param, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { S3StorageService } from './s3-storage.service';

@ApiTags('Storage')
@Controller('storage')
export class StorageController {
  constructor(private readonly storage: S3StorageService) {}

  @Get('avatars/:token')
  @ApiOperation({ summary: 'Resolve a private S3 avatar object to a short-lived signed URL' })
  async avatar(@Param('token') token: string, @Res() res: Response) {
    const objectKey = this.storage.decodeAvatarToken(token);
    if (!objectKey.startsWith('avatars/staff/')) {
      throw new BadRequestException('Avatar objectKey không hợp lệ.');
    }

    const parts = objectKey.split('/');
    const signed = await this.storage.createPresignedDownloadUrl({
      objectKey,
      originalName: parts[parts.length - 1] || 'avatar',
    });
    return res.redirect(302, signed.url);
  }
}
