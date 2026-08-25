import { Inject, Injectable } from '@nestjs/common';
import { AiModelQueryDto } from '../../dto/ai-model.dto';
import { AI_MODEL_REPOSITORY, AiModelRepositoryPort } from '../ports/ai-model.repository.port';
import { AI_MODEL_INTEGRITY_ANCHOR, AiModelIntegrityAnchorPort } from '../ports/ai-model-integrity-anchor.port';
import { getPagination, paginated } from '../../../shared/pagination.dto';
import { presentAiModel } from '../../domain/ai-model.presenter';

/** Lists AI models with optional type/search filter. Mirrors AiModelService.findAll(). */
@Injectable()
export class ListAiModelsUseCase {
  constructor(
    @Inject(AI_MODEL_REPOSITORY) private readonly repo: AiModelRepositoryPort,
    @Inject(AI_MODEL_INTEGRITY_ANCHOR) private readonly integrity: AiModelIntegrityAnchorPort,
  ) {}

  async execute(query: AiModelQueryDto) {
    const { page, limit: requestedLimit } = getPagination(query);
    const limit = Math.min(requestedLimit, 10);
    const skip = (page - 1) * limit;
    const { items, total } = await this.repo.findManyPaginated(
      { type: query.type, search: query.search, provider: query.provider, recommendedSpecialty: query.recommendedSpecialty, status: query.status, includeDeleted: query.includeDeleted },
      skip,
      limit,
    );

    let evaluations;
    try {
      evaluations = await this.integrity.evaluateMany(items);
    } catch {
      evaluations = items.map((model: any) => ({
        id: model.id,
        status: 'VERIFICATION_UNAVAILABLE' as const,
        dbMatches: false,
        chainMatches: false,
        onChainHash: null,
        storedHash: model.hash256 ?? null,
        recomputedHash: null,
      }));
    }
    const byId = new Map<string, (typeof evaluations)[number]>(evaluations.map((evaluation) => [evaluation.id, evaluation]));
    const validatedItems = items.map((model: any) => {
      const totalRatings = model.aiQualities?.length || 0;
      const positiveRatings = model.aiQualities?.filter((q: any) => q.trustablePercent === 100).length || 0;
      const averageAccuracy = totalRatings > 0 ? Math.round((positiveRatings / totalRatings) * 100) : null;
      const integrityEval = byId.get(model.id)!;
      return presentAiModel({
        ...model,
        averageAccuracy,
        totalRatings,
        blockchainStatus: integrityEval.status,
        audit: {
          status: integrityEval.status,
          dbMatches: integrityEval.dbMatches,
          chainMatches: integrityEval.chainMatches,
          onChainHash: integrityEval.onChainHash,
          storedHash: integrityEval.storedHash,
          recomputedHash: integrityEval.recomputedHash,
        },
      });
    });

    return paginated(validatedItems, total, page, limit);
  }
}
