import { Module } from '@nestjs/common';
import { ZkpService } from './services/zkp.service';

@Module({
  providers: [ZkpService],
  exports: [ZkpService],
})
export class ZkpModule {}
