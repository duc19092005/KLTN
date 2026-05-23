import { Module } from '@nestjs/common';
import { BackupService } from './backup.service';
import { BackupController } from './backup.controller';
import { BlockchainModule } from '../blockchain/blockchain.module';
import { EncryptionModule } from '../encryption/encryption.module';

@Module({
  imports: [BlockchainModule, EncryptionModule],
  providers: [BackupService],
  controllers: [BackupController],
})
export class BackupModule {}
