import { Module } from '@nestjs/common';
import { ClinicalDecisionController } from './controllers/clinical-decision.controller';
import { ClinicalDecisionService } from './services/clinical-decision.service';

@Module({
  controllers: [ClinicalDecisionController],
  providers: [ClinicalDecisionService],
  exports: [ClinicalDecisionService],
})
export class ClinicalDecisionModule {}
