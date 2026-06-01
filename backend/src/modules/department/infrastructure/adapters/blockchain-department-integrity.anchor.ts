import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/prisma/prisma.service';
import { BlockchainService } from '../../../../infrastructure/blockchain/blockchain.service';
import { AuditLoggerService } from '../../../../infrastructure/audit/audit-logger.service';
import { hashToBytes32 } from '../../../../infrastructure/audit/audit-hash.util';
import {
  DepartmentAnchorAction,
  DepartmentIntegrityAnchorPort,
  DepartmentIntegrityEvaluation,
} from '../../application/ports/department-integrity-anchor.port';
import { buildDepartmentSnapshot } from '../../domain/department-snapshot';

/**
 * Tamper-evidence adapter for departments. Logic copied verbatim from the
 * former DepartmentService (anchorDepartmentChange, evaluateIntegrity,
 * getHistory): salted hash, on-chain mirror via DepartmentRegistry,
 * hash256/dataSalt persistence, and the BlockchainLogger audit entry. On-chain
 * failures are non-fatal (flagged UNANCHORED). Only the salted hash goes on-chain.
 */
@Injectable()
export class BlockchainDepartmentIntegrityAnchor implements DepartmentIntegrityAnchorPort {
  constructor(
    private readonly prisma: PrismaService,
    private readonly blockchain: BlockchainService,
    private readonly audit: AuditLoggerService,
  ) {}

  async anchorChange(department: any, action: DepartmentAnchorAction, actorId?: string, before?: unknown): Promise<void> {
    const snapshot = buildDepartmentSnapshot(department);
    let dataHash: string | null = null;
    let dataSalt: string | null = null;
    let onChainStatus = 'PENDING';
    let txHash: string | null = null;
    let blockNumber: number | null = null;

    try {
      if (action === 'DELETE') {
        const res = await this.blockchain.removeDepartmentHash(department.id);
        onChainStatus = res.success ? 'ANCHORED' : 'UNANCHORED';
        txHash = (res as any).txHash ?? null;
        blockNumber = (res as any).blockNumber ?? null;
      } else {
        const { salt, hash } = this.audit.hashSnapshot(snapshot);
        dataHash = hash;
        dataSalt = salt;
        await this.prisma.department.update({ where: { id: department.id }, data: { hash256: hash, dataSalt: salt } });
        const res = await this.blockchain.setDepartmentHash(department.id, hashToBytes32(hash));
        onChainStatus = res.success ? 'ANCHORED' : 'UNANCHORED';
        txHash = (res as any).txHash ?? null;
        blockNumber = (res as any).blockNumber ?? null;
      }
    } catch {
      onChainStatus = 'UNANCHORED';
    }

    await this.audit.record({
      entity: 'Department',
      entityId: department.id,
      action,
      actorId,
      dataHash,
      dataSalt,
      before: before ?? null,
      after: action === 'DELETE' ? null : snapshot,
      onChainStatus,
      txHash,
      blockNumber,
    });
  }

  async evaluate(dept: any): Promise<DepartmentIntegrityEvaluation> {
    const snapshot = buildDepartmentSnapshot(dept);
    const recomputed = dept.dataSalt ? this.audit.recompute(snapshot, dept.dataSalt) : null;
    const dbHash = dept.hash256 || null;
    const onChain = await this.blockchain.getDepartmentHash(dept.id);
    const onChainNormalized = onChain ? onChain.toLowerCase() : null;
    const recomputedBytes32 = recomputed ? hashToBytes32(recomputed).toLowerCase() : null;

    const dbMatches = recomputed !== null && recomputed === dbHash;
    const chainMatches = recomputedBytes32 !== null && recomputedBytes32 === onChainNormalized;

    let status: 'VERIFIED' | 'TAMPERED' | 'UNANCHORED';
    if (!onChainNormalized) status = 'UNANCHORED';
    else if (chainMatches) status = 'VERIFIED';
    else status = 'TAMPERED';

    return {
      id: dept.id,
      departmentCode: dept.departmentCode,
      name: dept.name,
      status,
      dbMatches,
      chainMatches,
      recomputedHash: recomputed,
      storedHash: dbHash,
      onChainHash: onChain,
    };
  }

  history(id?: string) {
    return this.audit.history('Department', id);
  }
}
