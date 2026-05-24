import { Module } from '@nestjs/common';
import { HospitalService } from './hospital.service';
import { HospitalController } from './hospital.controller';
import { BlockchainModule } from '../blockchain/blockchain.module';
import { EncryptionModule } from '../encryption/encryption.module';

@Module({
  imports: [BlockchainModule, EncryptionModule],
  providers: [HospitalService],
  controllers: [HospitalController],
})
export class HospitalModule {}
