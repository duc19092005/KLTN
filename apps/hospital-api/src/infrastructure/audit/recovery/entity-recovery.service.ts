import { ConflictException, Injectable, Optional } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditAnchorService } from '../anchoring/audit-anchor.service';
import { AuditLoggerService } from '../logging/audit-logger.service';
import { EntityRecreationBundleCache, EntityRecreationService } from './entity-recreation.service';
import { VerifiedAuditBundleReader } from './verified-audit-bundle.reader';
import {
  ENTITY_DEPENDENCY_ORDER,
  EntityIntegrityWarning,
  EntityRecoveryTarget,
  RECOVERABLE_AUDIT_ENTITIES,
  RecoverableAuditEntity,
} from './entity-registry.config';
import { loadLiveEntitySnapshot } from './entity-snapshot.handler';
import { EntityClusterResolver } from './entity-cluster-resolver';
import { EntityIntegrityEvaluator } from './entity-integrity-evaluator';
import { EntityRecoveryExecutor } from './entity-recovery-executor';

type AnchoredAuditRow = NonNullable<Awaited<ReturnType<PrismaService['blockchainLogger']['findFirst']>>>;

/**
 * EntityRecoveryService coordinates integrity scanning and clinical entity restoration
 * using verified, on-chain anchored audit snapshots.
 */
@Injectable()
export class EntityRecoveryService {
  private readonly clusterResolver: EntityClusterResolver;
  private readonly evaluator: EntityIntegrityEvaluator;
  private readonly executor: EntityRecoveryExecutor;

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLoggerService,
    private readonly anchor: AuditAnchorService,
    @Optional() private readonly verifiedBundleReader?: VerifiedAuditBundleReader,
    @Optional() private readonly recreation?: EntityRecreationService,
  ) {
    this.clusterResolver = new EntityClusterResolver(this.prisma);
    this.evaluator = new EntityIntegrityEvaluator(this.prisma, this.anchor, this.clusterResolver, this.recreation);
    this.executor = new EntityRecoveryExecutor(
      this.prisma,
      this.audit,
      this.anchor,
      this.evaluator,
      this.verifiedBundleReader,
      this.recreation,
    );
  }

  async previewMany(targets: EntityRecoveryTarget[]) {
    const uniqueTargets = [...new Map(targets.map((target) => [this.targetKey(target.entity, target.entityId), target])).values()];
    uniqueTargets.sort((a, b) => (ENTITY_DEPENDENCY_ORDER[a.entity] ?? 99) - (ENTITY_DEPENDENCY_ORDER[b.entity] ?? 99));
    const items: Array<Record<string, unknown>> = [];
    const recreationCache = this.recreation?.createBundleCache();
    for (const target of uniqueTargets) {
      const live = await loadLiveEntitySnapshot(this.prisma, target.entity, target.entityId);
      if (!live) {
        if (!this.recreation) {
          items.push({ ...target, state: 'MISSING', operation: 'RECREATE', recoverable: false, blockers: ['ENTITY_RECREATION_UNAVAILABLE'], sensitiveDataHidden: true });
        } else {
          items.push({ ...(await this.recreation.previewOne(target, recreationCache)) });
        }
        continue;
      }

      const row = await this.findLatestRow(target.entity, target.entityId);
      const warning = row ? await this.evaluator.evaluateRow(row) : null;
      items.push({
        ...target,
        state: 'EXISTS',
        operation: warning?.recoverable ? 'UPDATE' : 'NONE',
        recoverable: Boolean(warning?.recoverable),
        sourceSeq: warning?.latestTrustedSeq ?? null,
        sourceBatchId: warning?.batchId ?? null,
        source: warning?.recoverable ? 'ANCHORED_AUDIT' : null,
        blockers: warning && !warning.recoverable ? warning.blockers : [],
        dependencies: warning?.dependencies ?? [],
        recoveryMode: warning?.recoveryMode ?? 'DIRECT_ENTITY',
        clusterKey: warning?.clusterKey ?? target.entityId,
        clusterLabel: warning?.clusterLabel ?? null,
        autoResolvable: warning?.autoResolvable ?? false,
        sensitiveDataHidden: true,
      });
    }
    return { items, total: items.length, recoverable: items.filter((item) => item.recoverable === true).length };
  }

  async listWarnings(limit = 100): Promise<{ items: EntityIntegrityWarning[]; total: number }> {
    const groups = await this.prisma.blockchainLogger.groupBy({
      by: ['entity', 'entityId'],
      where: {
        entity: { in: [...RECOVERABLE_AUDIT_ENTITIES] },
        entityId: { not: null },
        seq: { not: null },
      },
      _max: { seq: true },
      orderBy: { _max: { seq: 'desc' } },
      take: Math.min(Math.max(limit, 1), 200),
    });
    const rows = await this.prisma.blockchainLogger.findMany({
      where: { seq: { in: groups.map((group) => group._max.seq).filter((seq): seq is number => seq != null) } },
      orderBy: { seq: 'desc' },
    });

    const latest = new Map<string, AnchoredAuditRow>();
    for (const row of rows) {
      if (!this.isRecoverableEntity(row.entity) || !row.entityId) continue;
      const key = this.targetKey(row.entity, row.entityId);
      if (!latest.has(key)) latest.set(key, row);
    }

    const recreationCache = this.recreation?.createBundleCache();
    const evaluated = await Promise.all(
      Array.from(latest.values()).map((row) => this.evaluator.evaluateRow(row, recreationCache)),
    );
    const warnings = evaluated.filter((warning): warning is EntityIntegrityWarning => warning !== null);

    return { items: warnings, total: warnings.length };
  }

  async assertTrusted(entity: RecoverableAuditEntity, entityId: string): Promise<void> {
    const row = await this.findLatestRow(entity, entityId);
    if (!row) return;
    const warning = await this.evaluator.evaluateRow(row);
    if (!warning) return;

    throw new ConflictException({
      statusCode: 409,
      code: 'ENTITY_INTEGRITY_WARNING',
      message: warning.message,
      entity: warning.entity,
      entityId: warning.entityId,
      batchId: warning.batchId,
      latestTrustedSeq: warning.latestTrustedSeq,
      fieldsChanged: warning.fieldsChanged,
      blockers: warning.blockers,
      dependencies: warning.dependencies,
      recoveryMode: warning.recoveryMode,
      recoveryRequired: warning.recoverable,
    });
  }

  async recoverMany(targets: EntityRecoveryTarget[], actorId: string, reason: string) {
    const uniqueTargets = [...new Map(targets.map((target) => [this.targetKey(target.entity, target.entityId), target])).values()];
    uniqueTargets.sort((a, b) => (ENTITY_DEPENDENCY_ORDER[a.entity] ?? 99) - (ENTITY_DEPENDENCY_ORDER[b.entity] ?? 99));
    const results: Array<Record<string, unknown>> = [];
    const recreationCache = this.recreation?.createBundleCache();

    for (const target of uniqueTargets) {
      try {
        results.push(await this.executor.recoverOne(target, actorId, reason, recreationCache));
      } catch (error) {
        console.error('RECOVERY ERROR:', error);
        results.push({
          ...target,
          status: 'FAILED',
          message: this.safeErrorMessage(error),
        });
      }
    }

    return {
      requested: uniqueTargets.length,
      recovered: results.filter((result) => result.status === 'RECOVERED' || result.status === 'RECREATED').length,
      skipped: results.filter((result) => result.status === 'SKIPPED').length,
      failed: results.filter((result) => result.status === 'FAILED').length,
      results,
    };
  }

  private findLatestRow(entity: RecoverableAuditEntity, entityId: string) {
    return this.prisma.blockchainLogger.findFirst({
      where: { entity, entityId, seq: { not: null } },
      orderBy: { seq: 'desc' },
    });
  }

  private isRecoverableEntity(entity: string): entity is RecoverableAuditEntity {
    return (RECOVERABLE_AUDIT_ENTITIES as readonly string[]).includes(entity);
  }

  private targetKey(entity: RecoverableAuditEntity, entityId: string) { return `${entity}:${entityId}`; }

  private safeErrorMessage(error: unknown): string {
    if (error instanceof ConflictException) {
      const response = error.getResponse();
      if (typeof response === 'string') return response;
      if (response && typeof response === 'object' && 'message' in response) return String(response.message);
    }
    return 'Không thể khôi phục entity. Kiểm tra audit batch và các quan hệ liên quan.';
  }
}