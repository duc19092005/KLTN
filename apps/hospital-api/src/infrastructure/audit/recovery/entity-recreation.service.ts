import { ConflictException, Injectable, Optional } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLoggerService } from '../logging/audit-logger.service';
import { canonicalize } from '../crypto/audit-hash.util';
import {
  EntityRecreationTarget,
  createEntitySnapshotData,
  loadRecreationSnapshot,
  entityRecordExists,
  businessSnapshot,
} from './entity-recreation-factory';
import { RecoverableAuditEntity } from './entity-registry.config';
import { VerifiedAuditBundleReader } from './verified-audit-bundle.reader';
import { EntityRecreationBlockers } from './entity-recreation-blockers';
import {
  EntityRecreationBundleCache,
  EntityRecreationSourceResolver,
} from './entity-recreation-source-resolver';

export { EntityRecreationBundleCache } from './entity-recreation-source-resolver';
export type RecreatableAuditEntity = RecoverableAuditEntity;

type Snapshot = Record<string, unknown>;

export interface EntityRecreationPreview {
  entity: RecoverableAuditEntity;
  entityId: string;
  state: 'MISSING' | 'EXISTS';
  operation: 'RECREATE' | 'NONE';
  recoverable: boolean;
  sourceSeq: number | null;
  sourceBatchId: number | null;
  source: 'IPFS_BLOCKCHAIN_VERIFIED' | null;
  blockers: string[];
  dependencies: EntityRecreationTarget[];
  recoveryMode: 'DIRECT_ENTITY' | 'DEPENDENCY_CHAIN' | 'PITR_REQUIRED';
  sensitiveDataHidden: true;
  autoResolvable?: boolean;
  message?: string;
}

/**
 * EntityRecreationService orchestrates recreating deleted entities by restoring
 * their complete cryptographic state from IPFS and re-establishing dependencies.
 */
@Injectable()
export class EntityRecreationService {
  private readonly blockersInspector: EntityRecreationBlockers;
  private readonly sourceResolver: EntityRecreationSourceResolver;

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLoggerService,
    @Optional() private readonly verifiedBundleReader?: VerifiedAuditBundleReader,
  ) {
    this.blockersInspector = new EntityRecreationBlockers();
    this.sourceResolver = new EntityRecreationSourceResolver(this.prisma, this.verifiedBundleReader);
  }

  createBundleCache(): EntityRecreationBundleCache {
    return new Map();
  }

  async previewMany(targets: EntityRecreationTarget[]) {
    const unique = this.uniqueTargets(targets);
    const cache = this.createBundleCache();
    const items: EntityRecreationPreview[] = [];
    for (const target of unique) items.push(await this.previewOne(target, cache));
    return { items, total: items.length, recoverable: items.filter((item) => item.recoverable).length };
  }

  async previewOne(target: EntityRecreationTarget, cache: EntityRecreationBundleCache = new Map()): Promise<EntityRecreationPreview> {
    if (await entityRecordExists(this.prisma, target)) {
      return {
        ...target, state: 'EXISTS', operation: 'NONE', recoverable: false,
        sourceSeq: null, sourceBatchId: null, source: null,
        blockers: ['ENTITY_ALREADY_EXISTS'], dependencies: [], recoveryMode: 'DIRECT_ENTITY', sensitiveDataHidden: true,
      };
    }

    try {
      const localRow = this.prisma?.blockchainLogger?.findFirst
        ? await this.prisma.blockchainLogger.findFirst({
            where: {
              entity: { in: [target.entity, 'AdministrativeDeletion'] },
              entityId: target.entityId,
              batchId: { not: null },
              onChainStatus: 'ANCHORED',
            },
            orderBy: { seq: 'desc' },
          }).catch(() => null)
        : null;

      let snapshot: Snapshot | null = null;
      let sourceSeq: number | null = null;
      let sourceBatchId: number | null = null;

      if (localRow) {
        const snapshotFromLocal = this.sourceResolver.snapshotFromRow(localRow as any, target);
        if (snapshotFromLocal) {
          snapshot = this.sourceResolver.normalizeForRecreation(target.entity, snapshotFromLocal);
          sourceSeq = localRow.seq;
          sourceBatchId = localRow.batchId;
        }
      }

      if (!snapshot) {
        const source = await this.sourceResolver.resolveTrustedSource(target, cache);
        snapshot = this.sourceResolver.normalizeForRecreation(target.entity, source.snapshot);
        sourceSeq = source.sourceSeq;
        sourceBatchId = source.sourceBatchId;
      }

      const blockers = await this.blockersInspector.inspectBlockers(this.prisma, target, snapshot);
      const dependencyResult = await this.sourceResolver.resolveRecoverableDependencies(
        target,
        snapshot,
        blockers,
        cache,
        (dep, c) => this.previewOne(dep, c),
      );
      return {
        ...target,
        state: 'MISSING',
        operation: 'RECREATE',
        recoverable: dependencyResult.blockers.length === 0,
        sourceSeq,
        sourceBatchId,
        source: 'IPFS_BLOCKCHAIN_VERIFIED',
        blockers: dependencyResult.blockers,
        dependencies: dependencyResult.dependencies,
        recoveryMode: dependencyResult.dependencies.length ? 'DEPENDENCY_CHAIN' : 'DIRECT_ENTITY',
        sensitiveDataHidden: true,
      };
    } catch (error) {
      return {
        ...target, state: 'MISSING', operation: 'RECREATE', recoverable: false,
        sourceSeq: null, sourceBatchId: null, source: null,
        blockers: [this.safeErrorMessage(error)], dependencies: [], recoveryMode: 'PITR_REQUIRED', sensitiveDataHidden: true,
      };
    }
  }

  async recreate(
    target: EntityRecreationTarget,
    actorId: string,
    reason: string,
    cache: EntityRecreationBundleCache = new Map(),
  ) {
    return this.recreateWithDependencies(target, actorId, reason, cache, new Set());
  }

  private async recreateWithDependencies(
    target: EntityRecreationTarget,
    actorId: string,
    reason: string,
    cache: EntityRecreationBundleCache,
    ancestry: Set<string>,
  ) {
    const key = `${target.entity}:${target.entityId}`;
    if (ancestry.has(key)) throw new ConflictException('Phát hiện vòng lặp khóa ngoại trong chuỗi phục hồi.');
    const nextAncestry = new Set(ancestry).add(key);
    const source = await this.sourceResolver.resolveTrustedSource(target, cache);
    const snapshot = this.sourceResolver.normalizeForRecreation(target.entity, source.snapshot);
    const blockers = await this.blockersInspector.inspectBlockers(this.prisma, target, snapshot);
    const dependencyResult = await this.sourceResolver.resolveRecoverableDependencies(
      target,
      snapshot,
      blockers,
      cache,
      (dep, c) => this.previewOne(dep, c),
    );
    if (dependencyResult.blockers.length) {
      throw new ConflictException(`Không thể khôi phục entity: ${dependencyResult.blockers.join(', ')}.`);
    }
    for (const dependency of dependencyResult.dependencies) {
      if (!(await entityRecordExists(this.prisma, dependency))) {
        await this.recreateWithDependencies(dependency, actorId, `${reason} [dependency for ${key}]`, cache, nextAncestry);
      }
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`audit-entity-recreate:${target.entity}:${target.entityId}`}))`;
      if (await entityRecordExists(tx, target)) throw new ConflictException('Entity đã xuất hiện lại trong lúc khôi phục.');
      const concurrentBlockers = await this.blockersInspector.inspectBlockers(tx, target, snapshot);
      if (concurrentBlockers.length) throw new ConflictException(`Không thể khôi phục entity: ${concurrentBlockers.join(', ')}.`);

      await createEntitySnapshotData(tx, target, snapshot);
      const restored = await loadRecreationSnapshot(tx, target);
      if (!restored || canonicalize(restored) !== canonicalize(businessSnapshot(snapshot))) {
        throw new ConflictException('Entity sau khi tạo lại không khớp snapshot audit đã xác minh.');
      }

      await this.audit.recordV2({
        entity: target.entity,
        entityId: target.entityId,
        action: 'AUDIT_ENTITY_RECREATED_FROM_IPFS',
        actorId,
        before: null,
        after: restored,
        metadata: {
          reason,
          sourceSeq: source.sourceSeq,
          sourceBatchId: source.sourceBatchId,
          sourceArtifactHash: source.artifactHash,
        },
      }, tx);
    });

    return {
      ...target,
      status: 'RECREATED' as const,
      source: 'IPFS_BLOCKCHAIN_VERIFIED' as const,
      sourceSeq: source.sourceSeq,
      batchId: source.sourceBatchId,
    };
  }

  private uniqueTargets(targets: EntityRecreationTarget[]) {
    return [...new Map(targets.map((target) => [`${target.entity}:${target.entityId}`, target])).values()];
  }

  private safeErrorMessage(error: unknown): string {
    if (error instanceof ConflictException) {
      const response = error.getResponse();
      if (typeof response === 'string') return response;
      if (response && typeof response === 'object' && 'message' in response) return String(response.message);
    }
    return 'Không thể xác minh nguồn phục hồi entity từ IPFS/blockchain.';
  }
}