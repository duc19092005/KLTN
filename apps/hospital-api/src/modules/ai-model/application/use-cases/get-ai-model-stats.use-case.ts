import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/prisma/prisma.service';
import { AuditLoggerService } from '../../../../infrastructure/audit';
import { AuditAnchorService } from '../../../../infrastructure/audit';
import { computeAfterHashV2 } from '../../../../infrastructure/audit';
import { buildAiQualitySnapshot } from '../../domain/ai-quality-snapshot';

@Injectable()
export class GetAiModelStatsUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLoggerService,
    private readonly auditAnchor: AuditAnchorService,
  ) {}

  async execute() {
    // 1. Fetch all models and their associated qualities (ratings)
    const models = await this.prisma.aiModelRegistry.findMany({
      where: { isDeleted: false },
      include: {
        aiQualities: {
          include: {
            doctor: {
              include: {
                staffProfile: true,
              },
            },
          },
        },
      },
    });

    // 2. Compute statistics and audit each rating record
    const modelStats = await Promise.all(
      models.map(async (model) => {
        const totalRatings = model.aiQualities.length;
        const positiveRatings = model.aiQualities.filter((q) => q.trustablePercent === 100).length;
        const averageAccuracy = totalRatings > 0 ? (positiveRatings / totalRatings) * 100 : null;

        // Evaluate integrity of each quality (rating) record for this model
        const qualitiesWithAudit = await Promise.all(
          model.aiQualities.map(async (q) => {
            const auditResult = await this.evaluateQuality(q);
            return {
              id: q.id,
              doctorName: q.doctor.staffProfile.fullName,
              feedback: q.doctorConclusionAboutModel,
              createdAt: q.createdAt,
              satisfied: q.trustablePercent === 100,
              audit: auditResult,
            };
          }),
        );

        return {
          id: model.id,
          modelName: model.modelName,
          modelVersion: model.modelVersion,
          recommendedSpecialty: model.recommendedSpecialty,
          provider: model.provider,
          totalRatings,
          positiveRatings,
          negativeRatings: totalRatings - positiveRatings,
          averageAccuracy: averageAccuracy !== null ? Math.round(averageAccuracy * 10) / 10 : null, // rounded to 1 decimal place
          feedbacks: qualitiesWithAudit.filter((q) => !q.satisfied),
        };
      }),
    );

    // 3. Filter models with at least 1 rating for top/bottom
    const ratedModels = modelStats.filter((m) => m.totalRatings > 0);
    
    const topModels = [...ratedModels]
      .sort((a, b) => (b.averageAccuracy ?? 0) - (a.averageAccuracy ?? 0) || b.totalRatings - a.totalRatings)
      .slice(0, 5);

    // Only include models that actually need improvement (< 80% accuracy or has negative ratings)
    const bottomModels = [...ratedModels]
      .filter((m) => (m.averageAccuracy !== null && m.averageAccuracy < 80) || m.negativeRatings > 0)
      .sort((a, b) => (a.averageAccuracy ?? 0) - (b.averageAccuracy ?? 0) || b.negativeRatings - a.negativeRatings)
      .slice(0, 5);

    // Grab all recent negative feedbacks across all models
    const recentNegativeFeedbacks = modelStats
      .flatMap((m) =>
        m.feedbacks.map((f) => ({
          modelId: m.id,
          modelName: m.modelName,
          modelVersion: m.modelVersion,
          ...f,
        })),
      )
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, 10);

    return {
      allModels: modelStats,
      topModels,
      bottomModels,
      recentNegativeFeedbacks,
    };
  }

  private async evaluateQuality(quality: any) {
    const snapshot = buildAiQualitySnapshot(quality);
    const recomputed = quality.dataSalt ? this.audit.recompute(snapshot, quality.dataSalt) : null;
    const dbHash = quality.hash256 || null;
    const dbMatches = recomputed !== null && recomputed === dbHash;
    const currentAfterHash = computeAfterHashV2('AiQuality', quality.id, snapshot);

    const latestLog = await this.prisma.blockchainLogger.findFirst({
      where: { entity: 'AiQuality', entityId: quality.id, batchId: { not: null } },
      orderBy: { seq: 'desc' },
      select: { seq: true, afterHash: true, batchId: true },
    });

    let chainMatches = false;
    if (latestLog?.seq) {
      try {
        const proof = await this.auditAnchor.getInclusionProof(latestLog.seq);
        if (proof && proof.verified) {
          chainMatches = latestLog.afterHash === currentAfterHash;
        }
      } catch { /* proof verification failed */ }
    }

    let status: 'VERIFIED' | 'TAMPERED' | 'UNANCHORED';
    if (!latestLog || !latestLog.batchId) status = 'UNANCHORED';
    else if (dbMatches && chainMatches) status = 'VERIFIED';
    else status = 'TAMPERED';

    return {
      status,
      dbMatches,
      chainMatches,
      storedHash: dbHash,
      onChainHash: latestLog?.afterHash ?? null,
      recomputedHash: recomputed,
    };
  }
}
