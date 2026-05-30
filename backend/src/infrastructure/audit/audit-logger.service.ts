import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { computeRecordHash, generateSalt } from './audit-hash.util';

export type AuditAction = 'CREATE' | 'UPDATE' | 'DELETE';

/**
 * Maps an entity label to its foreign-key column on the BlockchainLogger table.
 * Exactly one of these FKs is populated per log row, letting us join a log back to
 * the concrete record it describes while keeping a single centralized logger table.
 */
const FK_FIELD: Record<string, string> = {
  Department: 'departmentId',
  StaffProfile: 'staffProfileId',
  DoctorProfile: 'doctorProfileId',
  Patient: 'patientId',
  AiModelRegistry: 'aiModelRegistryId',
  MedicalConclusion: 'medicalConclusionId',
  AiQuality: 'aiQualityId',
};

/**
 * AuditLoggerService is the shared write/read API for the centralized BlockchainLogger.
 * Services compute a snapshot of the business fields they want anchored and call record();
 * the integrity hash itself is mirrored on-chain by the calling service (e.g. via
 * DepartmentRegistry) so this service stays storage-agnostic.
 */
@Injectable()
export class AuditLoggerService {
  constructor(private readonly prisma: PrismaService) {}

  /** Compute a fresh salt + integrity hash for a snapshot. */
  hashSnapshot(snapshot: unknown): { salt: string; hash: string } {
    const salt = generateSalt();
    const hash = computeRecordHash(snapshot, salt);
    return { salt, hash };
  }

  /** Recompute the integrity hash for a snapshot using a known salt (verification). */
  recompute(snapshot: unknown, salt: string): string {
    return computeRecordHash(snapshot, salt);
  }

  /** Persist one change entry to the centralized logger. */
  async record(params: {
    entity: string;
    entityId: string;
    action: AuditAction;
    actorId?: string | null;
    dataHash?: string | null;
    dataSalt?: string | null;
    before?: unknown;
    after?: unknown;
    onChainStatus?: string;
    txHash?: string | null;
    blockNumber?: number | null;
    metadata?: unknown;
  }) {
    const fkField = FK_FIELD[params.entity];
    const data: Record<string, any> = {
      entity: params.entity,
      entityId: params.entityId,
      action: params.action,
      actorId: params.actorId ?? null,
      dataHash: params.dataHash ?? null,
      dataSalt: params.dataSalt ?? null,
      beforeJson: (params.before ?? null) as any,
      afterJson: (params.after ?? null) as any,
      onChainStatus: params.onChainStatus ?? 'PENDING',
      txHash: params.txHash ?? null,
      blockNumber: params.blockNumber ?? null,
      metadata: (params.metadata ?? null) as any,
    };
    if (fkField) data[fkField] = params.entityId;
    return this.prisma.blockchainLogger.create({ data: data as Prisma.BlockchainLoggerUncheckedCreateInput });
  }

  /** List change history for an entity (optionally a specific record), newest first. */
  history(entity: string, entityId?: string) {
    return this.prisma.blockchainLogger.findMany({
      where: { entity, ...(entityId ? { entityId } : {}) },
      orderBy: { createdAt: 'desc' },
    });
  }
}
