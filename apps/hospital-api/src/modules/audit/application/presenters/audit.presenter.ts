import { Injectable } from '@nestjs/common';
import { AuthUser } from '../../../../common/types/auth-user.type';
import {
  toDisplayAuditDiff,
  toDisplayAuditFields,
  verifyAuditRow,
  verifyAuditRowLight,
} from '../../../../infrastructure/audit';
import { AuditSubjectResolverService } from '../services/audit-subject-resolver.service';
import type { BlockchainLogger } from '@prisma/client';

export type AuditBatchRows = Map<number, BlockchainLogger[]>;

@Injectable()
export class AuditPresenter {
  constructor(private readonly resolver: AuditSubjectResolverService) {}

  presentAuditRow(
    row: any,
    actor: any,
    user: AuthUser | undefined,
    includeDetail: boolean,
    faceVerified = false,
    subject: any = null,
  ) {
    const verification = includeDetail ? verifyAuditRow(row) : verifyAuditRowLight(row);
    const diff = row.diffJson?.schema === 'KLTN_AUDIT_DIFF_V1'
      ? toDisplayAuditDiff(row.diffJson, {
          role: user?.role,
          faceVerified,
          clinicalContextAllowed: includeDetail && faceVerified,
          entity: row.entity,
        })
      : [];

    return {
      id: row.id,
      seq: row.seq,
      entity: row.entity,
      entityId: row.entityId,
      action: row.action,
      actorId: row.actorId,
      createdAt: row.createdAt,
      hashVersion: row.hashVersion,
      onChainStatus: row.onChainStatus,
      txHash: row.txHash,
      blockNumber: row.blockNumber,
      batchId: row.batchId,
      blockchainStatus: verification.status,
      verification: {
        ok: verification.ok,
        status: verification.status,
        version: verification.version,
        reason: verification.reason,
        suspiciousFields: verification.suspiciousFields,
      },
      actor: actor
        ? {
            id: actor.id,
            username: actor.username,
            email: actor.email,
            role: actor.role,
            displayName: actor.staffProfile?.fullName || actor.adminProfile?.adminUserName || actor.username,
          }
        : null,
      diff,
      fieldsChanged: toDisplayAuditFields(row.fieldsChanged ?? row.diffJson?.fieldsChanged),
      subject,
      hashes: {
        dataHash: row.dataHash,
        beforeHash: row.beforeHash,
        afterHash: row.afterHash,
        diffHash: row.diffHash,
        entryHash: row.entryHash,
        prevHash: row.prevHash,
      },
    };
  }

  buildBatchIntegritySummaries(byBatch: AuditBatchRows) {
    const map = new Map<
      number,
      { status: 'VERIFIED' | 'TAMPERED' | 'PENDING'; verified: number; tampered: number; pending: number; total: number }
    >();

    for (const [batchId, batchRows] of byBatch.entries()) {
      let verified = 0;
      let tampered = 0;
      let pending = 0;
      for (const row of batchRows) {
        const result = verifyAuditRowLight(row);
        if (result.status === 'VERIFIED') verified += 1;
        else if (result.status === 'TAMPERED') tampered += 1;
        else pending += 1;
      }
      const total = batchRows.length;
      const status: 'VERIFIED' | 'TAMPERED' | 'PENDING' =
        tampered > 0 ? 'TAMPERED' : pending > 0 ? 'PENDING' : total > 0 ? 'VERIFIED' : 'PENDING';
      map.set(batchId, { status, verified, tampered, pending, total });
    }

    return map;
  }

  summarizeIntegrityFromPresented(
    logs: Array<{ blockchainStatus?: string; verification?: { status?: string } }>,
  ) {
    let verified = 0;
    let tampered = 0;
    let pending = 0;
    for (const log of logs) {
      const status = log.blockchainStatus || log.verification?.status || 'PENDING';
      if (status === 'VERIFIED') verified += 1;
      else if (status === 'TAMPERED') tampered += 1;
      else pending += 1;
    }
    const total = logs.length;
    const status: 'VERIFIED' | 'TAMPERED' | 'PENDING' =
      tampered > 0 ? 'TAMPERED' : pending > 0 ? 'PENDING' : total > 0 ? 'VERIFIED' : 'PENDING';
    return { status, verified, tampered, pending, total };
  }

  async buildBatchContentSummaries(byBatch: AuditBatchRows) {
    const map = new Map<number, Array<{ entity: string; count: number; samples: string[] }>>();
    if (!byBatch.size) return map;

    await Promise.all(
      [...byBatch.entries()].map(async ([batchId, batchRows]) => {
        const entityCounts = new Map<string, { count: number; ids: string[] }>();
        for (const row of batchRows) {
          const bucket = entityCounts.get(row.entity) ?? { count: 0, ids: [] };
          bucket.count += 1;
          if (row.entityId && bucket.ids.length < 4 && !bucket.ids.includes(row.entityId)) {
            bucket.ids.push(row.entityId);
          }
          entityCounts.set(row.entity, bucket);
        }

        const summary = await Promise.all(
          [...entityCounts.entries()]
            .sort((a, b) => b[1].count - a[1].count)
            .slice(0, 6)
            .map(async ([entity, info]) => {
              const samples = await this.resolver.resolveSampleLabels(entity, info.ids);
              return { entity, count: info.count, samples };
            }),
        );
        map.set(batchId, summary);
      }),
    );

    return map;
  }
}