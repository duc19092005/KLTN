import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { AI_MODEL_REPOSITORY, AiModelRepositoryPort } from '../ports/ai-model.repository.port';
import { AI_MODEL_INTEGRITY_ANCHOR, AiModelIntegrityAnchorPort } from '../ports/ai-model-integrity-anchor.port';

/**
 * Integrity verification + change history for AI models. Behavior copied
 * verbatim from the former AiModelService (verifyAiModel, verifyAll, getHistory).
 */
@Injectable()
export class VerifyAiModelUseCase {
  constructor(
    @Inject(AI_MODEL_REPOSITORY) private readonly repo: AiModelRepositoryPort,
    @Inject(AI_MODEL_INTEGRITY_ANCHOR) private readonly integrity: AiModelIntegrityAnchorPort,
  ) {}

  /** Verify a single AI model's integrity against the on-chain hash. */
  async verifyOne(id: string) {
    const model = await this.repo.findById(id);
    if (!model) throw new NotFoundException('Không tìm thấy mô hình AI.');
    return this.integrity.evaluate(model);
  }

  /** Verify all AI models, returning a status summary. */
  async verifyAll() {
    const models = await this.repo.findAllOrdered();
    const items = await Promise.all(models.map((m) => this.integrity.evaluate(m)));
    const summary = items.reduce(
      (acc, item) => {
        acc[item.status] = (acc[item.status] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );
    return { total: items.length, summary, items };
  }

  /** Append-only change history (all or one model). */
  history(id?: string) {
    return this.integrity.history(id);
  }
}
