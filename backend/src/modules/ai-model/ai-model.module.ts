import { Module } from '@nestjs/common';
import { AiModelController } from './controllers/ai-model.controller';
import { AiModelService } from './services/ai-model.service';
import { BlockchainModule } from '../../infrastructure/blockchain/blockchain.module';

@Module({
  imports: [BlockchainModule],
  controllers: [AiModelController],
  providers: [AiModelService],
  exports: [AiModelService],
})
export class AiModelModule {}
