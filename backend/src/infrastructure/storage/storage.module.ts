import { Global, Module } from '@nestjs/common';
import { StorageController } from './storage.controller';
import { S3StorageService } from './s3-storage.service';

@Global()
@Module({
  controllers: [StorageController],
  providers: [S3StorageService],
  exports: [S3StorageService],
})
export class StorageModule {}
