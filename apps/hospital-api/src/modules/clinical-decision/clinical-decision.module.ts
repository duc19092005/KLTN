import { Module } from '@nestjs/common';
import { ClinicalDecisionController } from './controllers/clinical-decision.controller';
import { ClinicalDecisionService } from './services/clinical-decision.service';
import { ClinicalDecisionPolicy } from './application/policies/clinical-decision.policy';
import { ClinicalPromptBuilder } from './application/services/clinical-prompt.builder';
import { GetVisitResultsUseCase } from './application/use-cases/get-visit-results.use-case';
import { GenerateAiAnalysisUseCase } from './application/use-cases/generate-ai-analysis.use-case';
import { ReviewAiDiagnosisUseCase } from './application/use-cases/review-ai-diagnosis.use-case';
import { CreateMedicalConclusionUseCase } from './application/use-cases/create-medical-conclusion.use-case';
import { ListPatientMedicalHistoryUseCase } from './application/use-cases/list-patient-medical-history.use-case';
import { CLINICAL_DECISION_REPOSITORY } from './application/ports/clinical-decision.repository.port';
import { AI_PROVIDER_GATEWAY } from './application/ports/ai-provider-gateway.port';
import { MEDICAL_IMAGE_ATTACHMENT } from './application/ports/medical-image-attachment.port';
import { MEDICAL_CONCLUSION_INTEGRITY_ANCHOR } from './application/ports/medical-conclusion-integrity-anchor.port';
import { PrismaClinicalDecisionRepository } from './infrastructure/prisma/prisma-clinical-decision.repository';
import { HttpAiProviderGateway } from './infrastructure/adapters/http-ai-provider.gateway';
import { S3MedicalImageAttachmentAdapter } from './infrastructure/adapters/s3-medical-image-attachment.adapter';
import { BlockchainMedicalConclusionIntegrityAnchor } from './infrastructure/adapters/blockchain-medical-conclusion-integrity.anchor';

@Module({
  controllers: [ClinicalDecisionController],
  providers: [
    ClinicalDecisionService,
    GetVisitResultsUseCase,
    GenerateAiAnalysisUseCase,
    ReviewAiDiagnosisUseCase,
    CreateMedicalConclusionUseCase,
    ListPatientMedicalHistoryUseCase,
    ClinicalDecisionPolicy,
    ClinicalPromptBuilder,
    { provide: CLINICAL_DECISION_REPOSITORY, useClass: PrismaClinicalDecisionRepository },
    { provide: AI_PROVIDER_GATEWAY, useClass: HttpAiProviderGateway },
    { provide: MEDICAL_IMAGE_ATTACHMENT, useClass: S3MedicalImageAttachmentAdapter },
    { provide: MEDICAL_CONCLUSION_INTEGRITY_ANCHOR, useClass: BlockchainMedicalConclusionIntegrityAnchor },
  ],
  exports: [ClinicalDecisionService],
})
export class ClinicalDecisionModule {}
