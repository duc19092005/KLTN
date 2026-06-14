import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { AI_MODEL_INTEGRITY_ANCHOR, AiModelIntegrityAnchorPort } from '../ports/ai-model-integrity-anchor.port';
import { AI_MODEL_REPOSITORY, AiModelRepositoryPort } from '../ports/ai-model.repository.port';
import { buildAiModelSnapshot } from '../../domain/ai-model-snapshot';

/** Soft-deletes an AI model by marking isDeleted=true, then anchors that state. */
@Injectable()
export class DeleteAiModelUseCase {
  constructor(
    @Inject(AI_MODEL_REPOSITORY) private readonly repo: AiModelRepositoryPort,
    @Inject(AI_MODEL_INTEGRITY_ANCHOR) private readonly integrity: AiModelIntegrityAnchorPort,
  ) {}

  async execute(id: string, actorId?: string) {
    const existing = await this.repo.findById(id);
    if (!existing || existing.isDeleted) throw new NotFoundException('Không tìm thấy mô hình AI.');

    const before = buildAiModelSnapshot(existing);
    const deleted = await this.repo.softDelete(id);
    await this.integrity.anchorChange(deleted, 'DELETE', actorId, before);
    return { deleted: true, id };
  }
}
