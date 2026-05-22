import { Module } from '@nestjs/common';
import { AiModelController } from './ai-model.controller';
import { AiModelBlockchainController } from './ai-model-blockchain.controller';
import { AiModelService } from './ai-model.service';
import { PrismaModule } from '../prisma/prisma.module';
import { EncryptionModule } from '../encryption/encryption.module';
import { BlockchainModule } from '../blockchain/blockchain.module';

@Module({
  imports: [PrismaModule, EncryptionModule, BlockchainModule],
  controllers: [AiModelController, AiModelBlockchainController],
  providers: [AiModelService],
  exports: [AiModelService],
})
export class AiModelModule {}
