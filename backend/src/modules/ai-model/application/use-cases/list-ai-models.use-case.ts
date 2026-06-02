import { Inject, Injectable } from '@nestjs/common';
import { AiModelQueryDto } from '../../dto/ai-model.dto';
import { AI_MODEL_REPOSITORY, AiModelRepositoryPort } from '../ports/ai-model.repository.port';

/** Lists AI models with optional type/search filter. Mirrors AiModelService.findAll(). */
@Injectable()
export class ListAiModelsUseCase {
  constructor(@Inject(AI_MODEL_REPOSITORY) private readonly repo: AiModelRepositoryPort) {}

  execute(query: AiModelQueryDto) {
    return this.repo.findAll({ type: query.type, search: query.search });
  }
}
