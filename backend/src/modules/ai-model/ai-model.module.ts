import { Module } from '@nestjs/common';
import { AiModelController } from './controllers/ai-model.controller';
import { AiModelService } from './services/ai-model.service';

@Module({
  controllers: [AiModelController],
  providers: [AiModelService],
  exports: [AiModelService],
})
export class AiModelModule {}
