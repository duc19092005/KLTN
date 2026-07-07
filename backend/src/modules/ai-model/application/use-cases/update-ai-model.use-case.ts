import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { UpdateAiModelDto } from '../../dto/ai-model.dto';
import { AI_MODEL_CONNECTIVITY, AiModelConnectivityPort } from '../ports/ai-model-connectivity.port';
import { AI_MODEL_CRYPTO, AiModelCryptoPort } from '../ports/ai-model-crypto.port';
import { AI_MODEL_INTEGRITY_ANCHOR, AiModelIntegrityAnchorPort } from '../ports/ai-model-integrity-anchor.port';
import { AI_MODEL_REPOSITORY, AiModelRepositoryPort, UpdateAiModelData } from '../ports/ai-model.repository.port';
import { buildAiModelSnapshot } from '../../domain/ai-model-snapshot';

/**
 * Updates an AI model registry row and re-anchors the new business snapshot.
 * Leaving secretOrIpHash blank keeps the currently encrypted credential.
 */
@Injectable()
export class UpdateAiModelUseCase {
  constructor(
    @Inject(AI_MODEL_REPOSITORY) private readonly repo: AiModelRepositoryPort,
    @Inject(AI_MODEL_CRYPTO) private readonly crypto: AiModelCryptoPort,
    @Inject(AI_MODEL_CONNECTIVITY) private readonly connectivity: AiModelConnectivityPort,
    @Inject(AI_MODEL_INTEGRITY_ANCHOR) private readonly integrity: AiModelIntegrityAnchorPort,
  ) {}

  async execute(id: string, dto: UpdateAiModelDto, actorId?: string) {
    const existing = await this.repo.findById(id);
    if (!existing || existing.isDeleted || existing.status === 'DELETE') throw new NotFoundException('Không tìm thấy mô hình AI.');

    const type = dto.type ?? existing.type ?? 'API';
    if (type === 'API' && !(dto.provider ?? existing.provider)) {
      throw new BadRequestException('Vui lòng chọn nhà cung cấp khi cập nhật mô hình AI qua API.');
    }

    const provider = type === 'API' ? (dto.provider ?? existing.provider ?? 'other') : 'ip';
    const modelVersion = dto.modelVersion?.trim() || existing.modelVersion;
    const providerChanged = dto.provider !== undefined && dto.provider !== existing.provider;
    const modelChanged = dto.modelVersion !== undefined && dto.modelVersion.trim() !== existing.modelVersion;
    const endpointInput = dto.apiEndpoint !== undefined
      ? dto.apiEndpoint.trim() || undefined
      : providerChanged || modelChanged
        ? undefined
        : existing.apiEndpoint ?? undefined;
    const apiEndpoint = type === 'API'
      ? this.connectivity.resolveApiEndpoint(provider, endpointInput, modelVersion)
      : null;

    const data: UpdateAiModelData = {
      ...(dto.modelName !== undefined ? { modelName: dto.modelName.trim() } : {}),
      modelVersion,
      recommendedSpecialty: dto.recommendedSpecialty !== undefined ? dto.recommendedSpecialty.trim() || null : existing.recommendedSpecialty,
      type,
      provider,
      apiEndpoint,
      description: dto.description !== undefined ? dto.description.trim() || null : existing.description,
    };

    const newSecret = dto.secretOrIpHash?.trim();
    if (newSecret) {
      data.ipHashEncrypted = this.crypto.encrypt(newSecret);
      data.ipHashPlain = this.crypto.fingerprint(newSecret);
    }

    const before = buildAiModelSnapshot(existing);
    const updated = await this.repo.update(id, data);
    await this.integrity.anchorChange(updated, 'UPDATE', actorId, before);
    return updated;
  }
}
