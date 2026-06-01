import { Inject, Injectable } from '@nestjs/common';
import { TestAiModelApiDto } from '../../dto/ai-model.dto';
import { AI_MODEL_CONNECTIVITY, AiModelConnectivityPort } from '../ports/ai-model-connectivity.port';

/** Tests live connectivity to an AI provider. Mirrors AiModelService.testApi(). */
@Injectable()
export class TestAiModelApiUseCase {
  constructor(@Inject(AI_MODEL_CONNECTIVITY) private readonly connectivity: AiModelConnectivityPort) {}

  execute(dto: TestAiModelApiDto) {
    return this.connectivity.test({
      provider: dto.provider,
      modelVersion: dto.modelVersion,
      secretOrIpHash: dto.secretOrIpHash,
      apiEndpoint: dto.apiEndpoint,
    });
  }
}
