import { Inject, Injectable } from '@nestjs/common';
import { AiModelQueryDto } from '../../dto/ai-model.dto';
import { AI_MODEL_REPOSITORY, AiModelRepositoryPort } from '../ports/ai-model.repository.port';
import { AI_MODEL_INTEGRITY_ANCHOR, AiModelIntegrityAnchorPort } from '../ports/ai-model-integrity-anchor.port';
import { getPagination, paginated } from '../../../shared/pagination.dto';

/** Lists AI models with optional type/search filter. Mirrors AiModelService.findAll(). */
@Injectable()
export class ListAiModelsUseCase {
  constructor(
    @Inject(AI_MODEL_REPOSITORY) private readonly repo: AiModelRepositoryPort,
    @Inject(AI_MODEL_INTEGRITY_ANCHOR) private readonly integrity: AiModelIntegrityAnchorPort,
  ) {}

  async execute(query: AiModelQueryDto) {
    const { page, limit, skip } = getPagination(query);
    const { items, total } = await this.repo.findManyPaginated(
      { type: query.type, search: query.search, provider: query.provider },
      skip,
      limit,
    );

    const validatedItems = await Promise.all(
      items.map(async (model: any) => {
        const totalRatings = model.aiQualities?.length || 0;
        const positiveRatings = model.aiQualities?.filter((q: any) => q.trustablePercent === 100).length || 0;
        const averageAccuracy = totalRatings > 0 ? Math.round((positiveRatings / totalRatings) * 100) : null;
        
        let integrityEval;
        try {
          integrityEval = await this.integrity.evaluate(model);
        } catch (err) {
          integrityEval = {
            status: 'UNANCHORED',
            dbMatches: false,
            chainMatches: false,
            onChainHash: null,
            storedHash: null,
            recomputedHash: null,
          };
        }

        return {
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
        };
      })
    );

    return paginated(validatedItems, total, page, limit);
  }
}
