import { Inject, Injectable } from '@nestjs/common';
import { AiModelQueryDto } from '../../dto/ai-model.dto';
import { AI_MODEL_REPOSITORY, AiModelRepositoryPort } from '../ports/ai-model.repository.port';

/** Lists AI models with optional type/search filter. Mirrors AiModelService.findAll(). */
@Injectable()
export class ListAiModelsUseCase {
  constructor(@Inject(AI_MODEL_REPOSITORY) private readonly repo: AiModelRepositoryPort) {}

  async execute(query: AiModelQueryDto) {
    const models = await this.repo.findAll({ type: query.type, search: query.search });
    return models.map((model: any) => {
      const totalRatings = model.aiQualities?.length || 0;
      const positiveRatings = model.aiQualities?.filter((q: any) => q.trustablePercent === 100).length || 0;
      const averageAccuracy = totalRatings > 0 ? Math.round((positiveRatings / totalRatings) * 100) : null;
      
      return {
        ...model,
        averageAccuracy,
        totalRatings,
      };
    });
  }
}
