import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { AI_MODEL_INTEGRITY_ANCHOR, AiModelIntegrityAnchorPort } from '../ports/ai-model-integrity-anchor.port';
import { AI_MODEL_REPOSITORY, AiModelRepositoryPort } from '../ports/ai-model.repository.port';
import { buildAiModelSnapshot } from '../../domain/ai-model-snapshot';
import { EntityRecoveryService } from '../../../../infrastructure/audit/entity-recovery.service';

/** Soft-deletes an AI model by marking isDeleted=true, then anchors that state. */
@Injectable()
export class DeleteAiModelUseCase {
  constructor(
    @Inject(AI_MODEL_REPOSITORY) private readonly repo: AiModelRepositoryPort,
    @Inject(AI_MODEL_INTEGRITY_ANCHOR) private readonly integrity: AiModelIntegrityAnchorPort,
    private readonly entityRecovery: EntityRecoveryService,
  ) {}

  async execute(id: string, actorId?: string) {
    const existing = await this.repo.findById(id);
    if (!existing || existing.isDeleted || existing.status === 'DELETE') throw new NotFoundException('Không tìm thấy mô hình AI.');
    await this.entityRecovery.assertTrusted('AiModelRegistry', id);

    const before = buildAiModelSnapshot(existing);
    await this.repo.softDelete(
      id,
      (deleted, tx) => this.integrity.anchorChange(deleted, 'DELETE', actorId, before, tx),
    );
    return { deleted: true, id };
  }
}
