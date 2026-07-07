import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { AI_MODEL_REPOSITORY, AiModelRepositoryPort } from '../ports/ai-model.repository.port';
import { AI_MODEL_INTEGRITY_ANCHOR, AiModelIntegrityAnchorPort } from '../ports/ai-model-integrity-anchor.port';

/**
 * Fetches one AI model and attaches its integrity audit summary. Behavior
 * copied verbatim from the former AiModelService.findOne().
 */
@Injectable()
export class FindAiModelUseCase {
  constructor(
    @Inject(AI_MODEL_REPOSITORY) private readonly repo: AiModelRepositoryPort,
    @Inject(AI_MODEL_INTEGRITY_ANCHOR) private readonly integrity: AiModelIntegrityAnchorPort,
  ) {}

  async execute(id: string) {
    const model = await this.repo.findByIdOrThrow(id);
    if (model.isDeleted || model.status === 'DELETE') throw new NotFoundException('Không tìm thấy mô hình AI.');
    const integrity = await this.integrity.evaluate(model);
    
    const totalRatings = model.aiQualities?.length || 0;
    const positiveRatings = model.aiQualities?.filter((q: any) => q.trustablePercent === 100).length || 0;
    const averageAccuracy = totalRatings > 0 ? Math.round((positiveRatings / totalRatings) * 100) : null;

    return {
      ...model,
      averageAccuracy,
      totalRatings,
      audit: {
        status: integrity.status,
        dbMatches: integrity.dbMatches,
        chainMatches: integrity.chainMatches,
        onChainHash: integrity.onChainHash,
        storedHash: integrity.storedHash,
        recomputedHash: integrity.recomputedHash,
      },
    };
  }
}
