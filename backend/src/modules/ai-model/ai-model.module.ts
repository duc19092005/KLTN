import { Module } from '@nestjs/common';
import { AiModelController } from './controllers/ai-model.controller';
import { AiModelService } from './services/ai-model.service';
import { BlockchainModule } from '../../infrastructure/blockchain/blockchain.module';
import { CreateAiModelUseCase } from './application/use-cases/create-ai-model.use-case';
import { UpdateAiModelUseCase } from './application/use-cases/update-ai-model.use-case';
import { DeleteAiModelUseCase } from './application/use-cases/delete-ai-model.use-case';
import { ListAiModelsUseCase } from './application/use-cases/list-ai-models.use-case';
import { FindAiModelUseCase } from './application/use-cases/find-ai-model.use-case';
import { TestAiModelApiUseCase } from './application/use-cases/test-ai-model-api.use-case';
import { VerifyAiModelUseCase } from './application/use-cases/verify-ai-model.use-case';
import { SetAiModelStatusUseCase } from './application/use-cases/set-ai-model-status.use-case';
import { AI_MODEL_REPOSITORY } from './application/ports/ai-model.repository.port';
import { AI_MODEL_CRYPTO } from './application/ports/ai-model-crypto.port';
import { AI_MODEL_CONNECTIVITY } from './application/ports/ai-model-connectivity.port';
import { AI_MODEL_INTEGRITY_ANCHOR } from './application/ports/ai-model-integrity-anchor.port';
import { PrismaAiModelRepository } from './infrastructure/prisma/prisma-ai-model.repository';
import { AiModelCryptoAdapter } from './infrastructure/adapters/ai-model-crypto.adapter';
import { HttpAiModelConnectivityAdapter } from './infrastructure/adapters/http-ai-model-connectivity.adapter';
import { BlockchainAiModelIntegrityAnchor } from './infrastructure/adapters/blockchain-ai-model-integrity.anchor';

import { RateAiModelUseCase } from './application/use-cases/rate-ai-model.use-case';
import { GetAiModelStatsUseCase } from './application/use-cases/get-ai-model-stats.use-case';

@Module({
  imports: [BlockchainModule],
  controllers: [AiModelController],
  providers: [
    AiModelService,
    CreateAiModelUseCase,
    UpdateAiModelUseCase,
    DeleteAiModelUseCase,
    ListAiModelsUseCase,
    FindAiModelUseCase,
    TestAiModelApiUseCase,
    VerifyAiModelUseCase,
    SetAiModelStatusUseCase,
    RateAiModelUseCase,
    GetAiModelStatsUseCase,
    { provide: AI_MODEL_REPOSITORY, useClass: PrismaAiModelRepository },
    { provide: AI_MODEL_CRYPTO, useClass: AiModelCryptoAdapter },
    { provide: AI_MODEL_CONNECTIVITY, useClass: HttpAiModelConnectivityAdapter },
    { provide: AI_MODEL_INTEGRITY_ANCHOR, useClass: BlockchainAiModelIntegrityAnchor },
  ],
  exports: [AiModelService],
})
export class AiModelModule {}
