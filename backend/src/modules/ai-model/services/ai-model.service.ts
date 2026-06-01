import { Injectable } from '@nestjs/common';
import { AiModelQueryDto, CreateAiModelDto, TestAiModelApiDto } from '../dto/ai-model.dto';
import { CreateAiModelUseCase } from '../application/use-cases/create-ai-model.use-case';
import { ListAiModelsUseCase } from '../application/use-cases/list-ai-models.use-case';
import { FindAiModelUseCase } from '../application/use-cases/find-ai-model.use-case';
import { TestAiModelApiUseCase } from '../application/use-cases/test-ai-model-api.use-case';
import { VerifyAiModelUseCase } from '../application/use-cases/verify-ai-model.use-case';

/**
 * Facade preserving the controller-facing API. Each method delegates to a
 * single use case; no business logic lives here (Clean Architecture refactor).
 */
@Injectable()
export class AiModelService {
  constructor(
    private readonly createAiModelUseCase: CreateAiModelUseCase,
    private readonly listAiModelsUseCase: ListAiModelsUseCase,
    private readonly findAiModelUseCase: FindAiModelUseCase,
    private readonly testAiModelApiUseCase: TestAiModelApiUseCase,
    private readonly verifyAiModelUseCase: VerifyAiModelUseCase,
  ) {}

  create(dto: CreateAiModelDto, adminUserId: string) {
    return this.createAiModelUseCase.execute(dto, adminUserId);
  }

  findAll(query: AiModelQueryDto) {
    return this.listAiModelsUseCase.execute(query);
  }

  findOne(id: string) {
    return this.findAiModelUseCase.execute(id);
  }

  testApi(dto: TestAiModelApiDto) {
    return this.testAiModelApiUseCase.execute(dto);
  }

  getHistory(id?: string) {
    return this.verifyAiModelUseCase.history(id);
  }

  verifyAiModel(id: string) {
    return this.verifyAiModelUseCase.verifyOne(id);
  }

  verifyAll() {
    return this.verifyAiModelUseCase.verifyAll();
  }
}
