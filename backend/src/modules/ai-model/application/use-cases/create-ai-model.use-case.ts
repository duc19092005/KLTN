import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { CreateAiModelDto } from '../../dto/ai-model.dto';
import { AI_MODEL_REPOSITORY, AiModelRepositoryPort } from '../ports/ai-model.repository.port';
import { AI_MODEL_CRYPTO, AiModelCryptoPort } from '../ports/ai-model-crypto.port';
import { AI_MODEL_CONNECTIVITY, AiModelConnectivityPort } from '../ports/ai-model-connectivity.port';
import { AI_MODEL_INTEGRITY_ANCHOR, AiModelIntegrityAnchorPort } from '../ports/ai-model-integrity-anchor.port';

/**
 * Registers a new AI model. Behavior copied verbatim from the former
 * AiModelService.create(): provider/endpoint resolution, AES-256 encryption of
 * the (optional) key, fingerprinting, persistence, then on-chain anchor + audit.
 */
@Injectable()
export class CreateAiModelUseCase {
  constructor(
    @Inject(AI_MODEL_REPOSITORY) private readonly repo: AiModelRepositoryPort,
    @Inject(AI_MODEL_CRYPTO) private readonly crypto: AiModelCryptoPort,
    @Inject(AI_MODEL_CONNECTIVITY) private readonly connectivity: AiModelConnectivityPort,
    @Inject(AI_MODEL_INTEGRITY_ANCHOR) private readonly integrity: AiModelIntegrityAnchorPort,
  ) {}

  async execute(dto: CreateAiModelDto, adminUserId: string) {
    if (dto.type === 'API' && !dto.provider) {
      throw new BadRequestException('Provider is required when adding AI model by API');
    }
    const apiEndpoint = dto.type === 'API' ? this.connectivity.resolveApiEndpoint(dto.provider || 'other', dto.apiEndpoint, dto.modelVersion) : null;

    // Local/self-hosted models (Llama, Ollama, vLLM) often need no API key. When the key is
    // omitted, use the endpoint (or model id) as the identity material so each model still gets
    // a unique AES blob + fingerprint. ipHashEncrypted is NOT NULL, so we always store something.
    const secretMaterial = dto.secretOrIpHash?.trim() || apiEndpoint || dto.modelVersion.trim();
    const encrypted = this.crypto.encrypt(secretMaterial);
    const plainFingerprint = this.crypto.fingerprint(secretMaterial);

    const model = await this.repo.create({
      modelName: dto.modelName.trim(),
      modelVersion: dto.modelVersion.trim(),
      recommendedSpecialty: dto.recommendedSpecialty?.trim() || null,
      type: dto.type,
      provider: dto.type === 'API' ? dto.provider || 'other' : 'ip',
      apiEndpoint,
      ipHashEncrypted: encrypted,
      ipHashPlain: plainFingerprint,
      description: dto.description?.trim() || null,
      createdBy: adminUserId,
    });

    await this.integrity.anchorChange(model, 'CREATE', adminUserId, null);
    return model;
  }
}
