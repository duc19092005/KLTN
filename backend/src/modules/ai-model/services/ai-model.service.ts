import { Injectable } from '@nestjs/common';
import { AiModelQueryDto, CreateAiModelDto, TestAiModelApiDto, UpdateAiModelDto } from '../dto/ai-model.dto';
import { CreateAiModelUseCase } from '../application/use-cases/create-ai-model.use-case';
import { UpdateAiModelUseCase } from '../application/use-cases/update-ai-model.use-case';
import { DeleteAiModelUseCase } from '../application/use-cases/delete-ai-model.use-case';
import { ListAiModelsUseCase } from '../application/use-cases/list-ai-models.use-case';
import { FindAiModelUseCase } from '../application/use-cases/find-ai-model.use-case';
import { TestAiModelApiUseCase } from '../application/use-cases/test-ai-model-api.use-case';
import { VerifyAiModelUseCase } from '../application/use-cases/verify-ai-model.use-case';
import { RateAiModelUseCase } from '../application/use-cases/rate-ai-model.use-case';
import { GetAiModelStatsUseCase } from '../application/use-cases/get-ai-model-stats.use-case';
import { SetAiModelStatusUseCase } from '../application/use-cases/set-ai-model-status.use-case';
import { ListAvailableAiModelsUseCase } from '../application/use-cases/list-available-ai-models.use-case';

/**
 * Facade preserving the controller-facing API. Each method delegates to a
 * single use case; no business logic lives here (Clean Architecture refactor).
 */
@Injectable()
export class AiModelService {
  constructor(
    private readonly createAiModelUseCase: CreateAiModelUseCase,
    private readonly updateAiModelUseCase: UpdateAiModelUseCase,
    private readonly deleteAiModelUseCase: DeleteAiModelUseCase,
    private readonly listAiModelsUseCase: ListAiModelsUseCase,
    private readonly findAiModelUseCase: FindAiModelUseCase,
    private readonly testAiModelApiUseCase: TestAiModelApiUseCase,
    private readonly verifyAiModelUseCase: VerifyAiModelUseCase,
    private readonly rateAiModelUseCase: RateAiModelUseCase,
    private readonly getAiModelStatsUseCase: GetAiModelStatsUseCase,
    private readonly setAiModelStatusUseCase: SetAiModelStatusUseCase,
    private readonly listAvailableAiModelsUseCase: ListAvailableAiModelsUseCase,
  ) {}

  create(dto: CreateAiModelDto, adminUserId: string) {
    return this.createAiModelUseCase.execute(dto, adminUserId);
  }

  update(id: string, dto: UpdateAiModelDto, adminUserId: string) {
    return this.updateAiModelUseCase.execute(id, dto, adminUserId);
  }

  remove(id: string, adminUserId: string) {
    return this.deleteAiModelUseCase.execute(id, adminUserId);
  }

  hide(id: string, adminUserId: string) {
    return this.setAiModelStatusUseCase.execute(id, 'INACTIVE', adminUserId);
  }

  restore(id: string, adminUserId: string) {
    return this.setAiModelStatusUseCase.execute(id, 'ACTIVE', adminUserId);
  }

  findAll(query: AiModelQueryDto) {
    return this.listAiModelsUseCase.execute(query);
  }

  findOne(id: string) {
    return this.findAiModelUseCase.execute(id);
  }

  findAvailableForDiagnosis() {
    return this.listAvailableAiModelsUseCase.execute();
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

  rateModel(modelId: string, userId: string, aiDiagnosisId: string, satisfied: boolean, feedback?: string) {
    return this.rateAiModelUseCase.execute(modelId, userId, aiDiagnosisId, satisfied, feedback);
  }

  getStats() {
    return this.getAiModelStatsUseCase.execute();
  }
}
