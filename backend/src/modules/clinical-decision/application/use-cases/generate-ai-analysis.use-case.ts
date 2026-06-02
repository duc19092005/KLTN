import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { GenerateAiAnalysisDto } from '../../dto/clinical-decision.dto';
import { CLINICAL_AI_DISCLAIMER } from '../../domain/clinical-ai.constants';
import { ClinicalDecisionPolicy } from '../policies/clinical-decision.policy';
import { ClinicalPromptBuilder } from '../services/clinical-prompt.builder';
import {
  CLINICAL_DECISION_REPOSITORY,
  ClinicalDecisionRepositoryPort,
} from '../ports/clinical-decision.repository.port';
import { AI_PROVIDER_GATEWAY, AiProviderGatewayPort } from '../ports/ai-provider-gateway.port';
import { MEDICAL_IMAGE_ATTACHMENT, MedicalImageAttachmentPort } from '../ports/medical-image-attachment.port';

/**
 * Generates an AI suggestion for a visit. Behavior copied verbatim from the
 * former ClinicalDecisionService.generateAiAnalysis(): model selection,
 * API-backed validation, multimodal prompt + image attachment, and persisting
 * the result as an AI_SUGGESTED diagnosis. AI never finalizes a conclusion.
 */
@Injectable()
export class GenerateAiAnalysisUseCase {
  constructor(
    @Inject(CLINICAL_DECISION_REPOSITORY) private readonly repo: ClinicalDecisionRepositoryPort,
    @Inject(AI_PROVIDER_GATEWAY) private readonly aiGateway: AiProviderGatewayPort,
    @Inject(MEDICAL_IMAGE_ATTACHMENT) private readonly imageAttachment: MedicalImageAttachmentPort,
    private readonly promptBuilder: ClinicalPromptBuilder,
    private readonly policy: ClinicalDecisionPolicy,
  ) {}

  async execute(dto: GenerateAiAnalysisDto, doctorUserId: string) {
    const doctor = await this.repo.findDoctorByUserId(doctorUserId);
    if (!doctor) throw new BadRequestException('Current user does not have doctor profile');

    const visit = await this.repo.findVisitById(dto.visitId);
    this.policy.assertDoctorOwnsVisit(visit, doctor.id);

    const fullVisit = await this.repo.findFullVisit(dto.visitId);
    this.policy.assertReadyForClinicalDecision(fullVisit.status);

    const aiModel = dto.aiModelId
      ? await this.repo.findAiModelById(dto.aiModelId)
      : await this.repo.findDefaultAiModelForSpecialty(fullVisit.doctor.specialty);

    if (!aiModel) throw new NotFoundException('No AI model registered');
    if (aiModel.type !== 'API') throw new BadRequestException('Selected model is not API-backed and cannot generate live AI analysis');
    if (!aiModel.apiEndpoint) throw new BadRequestException('Selected AI model does not have an API endpoint configured');

    const prompt = this.promptBuilder.build(fullVisit);
    // Pull the actual image bytes so the model can SEE the X-ray/MRI, not just a private URL.
    const images = await this.imageAttachment.collectImageAttachments(fullVisit);
    const providerResponse = await this.aiGateway.generate(aiModel, prompt, images);

    const result = JSON.stringify({
      source: 'REAL_AI_MODEL',
      isMock: false,
      provider: aiModel.provider || 'other',
      modelName: aiModel.modelName,
      modelVersion: aiModel.modelVersion,
      generatedAt: new Date().toISOString(),
      imageCount: images.length,
      analysis: providerResponse.parsed || providerResponse.text,
      disclaimer: CLINICAL_AI_DISCLAIMER,
    });

    return this.repo.createAiDiagnosis({
      aiModelId: aiModel.id,
      patientId: fullVisit.patientId,
      visitId: fullVisit.id,
      prompt,
      result,
      confidence: providerResponse.confidence,
    });
  }
}
