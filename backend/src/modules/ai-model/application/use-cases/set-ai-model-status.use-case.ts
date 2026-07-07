import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { OperationalStatus } from '@prisma/client';
import { AI_MODEL_INTEGRITY_ANCHOR, AiModelIntegrityAnchorPort } from '../ports/ai-model-integrity-anchor.port';
import { AI_MODEL_REPOSITORY, AiModelRepositoryPort } from '../ports/ai-model.repository.port';
import { buildAiModelSnapshot } from '../../domain/ai-model-snapshot';

/** Changes AI model visibility without deleting it. INACTIVE remains list-visible. */
@Injectable()
export class SetAiModelStatusUseCase {
  constructor(
    @Inject(AI_MODEL_REPOSITORY) private readonly repo: AiModelRepositoryPort,
    @Inject(AI_MODEL_INTEGRITY_ANCHOR) private readonly integrity: AiModelIntegrityAnchorPort,
  ) {}

  async execute(id: string, status: 'ACTIVE' | 'INACTIVE', actorId?: string) {
    const existing = await this.repo.findById(id);
    if (!existing || existing.isDeleted || existing.status === OperationalStatus.DELETE) {
      throw new NotFoundException('Không tìm thấy mô hình AI.');
    }

    const before = buildAiModelSnapshot(existing);
    const updated = await this.repo.update(id, { status, isDeleted: false });
    await this.integrity.anchorChange(updated, 'UPDATE', actorId, before);
    return updated;
  }
}
