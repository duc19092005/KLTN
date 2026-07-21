import { Inject, Injectable } from '@nestjs/common';
import { AI_MODEL_REPOSITORY, AiModelRepositoryPort } from '../ports/ai-model.repository.port';

@Injectable()
export class ListAvailableAiModelsUseCase {
  constructor(@Inject(AI_MODEL_REPOSITORY) private readonly repo: AiModelRepositoryPort) {}

  async execute() {
    const models = await this.repo.findAvailableForDiagnosis();
    return models.map((model) => {
      const ratings = model.aiQualities;
      const reliability = ratings.length
        ? Math.round(ratings.reduce((sum, rating) => sum + rating.trustablePercent, 0) / ratings.length)
        : null;
      return {
        id: model.id,
        name: model.modelName,
        version: model.modelVersion,
        recommendedSpecialty: model.recommendedSpecialty,
        status: model.status,
        reliability,
      };
    });
  }
}
