import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/prisma/prisma.service';
import { BlockchainService } from '../../../../infrastructure/blockchain/blockchain.service';
import { AuditAction, AuditLoggerService } from '../../../../infrastructure/audit/audit-logger.service';
import { hashToBytes32 } from '../../../../infrastructure/audit/audit-hash.util';
import {
  StaffIntegrityAnchorPort,
  StaffIntegrityEvaluation,
} from '../../application/ports/staff-integrity-anchor.port';
import { buildStaffSnapshot } from '../../domain/staff-snapshot';

/**
 * Tamper-evidence adapter for (non-doctor) staff. Logic copied verbatim from the
 * former StaffService (anchorStaffChange, evaluateIntegrity, getHistory): salted
 * hash, on-chain mirror via StaffRegistry, hash256/dataSalt persistence, and the
 * BlockchainLogger audit entry. Only the salted hash goes on-chain.
 */
@Injectable()
export class BlockchainStaffIntegrityAnchor implements StaffIntegrityAnchorPort {
  constructor(
    private readonly prisma: PrismaService,
    private readonly blockchain: BlockchainService,
    private readonly audit: AuditLoggerService,
  ) {}

  async anchorChange(staffProfile: any, action: AuditAction, actorId?: string, before?: unknown): Promise<void> {
    const snapshot = buildStaffSnapshot(staffProfile);
    let dataHash: string | null = null;
    let dataSalt: string | null = null;
    let onChainStatus = 'PENDING';
    let txHash: string | null = null;
    let blockNumber: number | null = null;

    try {
      if (action === 'DELETE') {
        const res = await this.blockchain.removeStaffHash(staffProfile.id);
        onChainStatus = res.success ? 'ANCHORED' : 'UNANCHORED';
        txHash = (res as any).txHash ?? null;
        blockNumber = (res as any).blockNumber ?? null;
      } else {
        const { salt, hash } = this.audit.hashSnapshot(snapshot);
        dataHash = hash;
        dataSalt = salt;
        await this.prisma.staffProfile.update({ where: { id: staffProfile.id }, data: { hash256: hash, dataSalt: salt } });
        const res = await this.blockchain.setStaffHash(staffProfile.id, hashToBytes32(hash));
        onChainStatus = res.success ? 'ANCHORED' : 'UNANCHORED';
        txHash = (res as any).txHash ?? null;
        blockNumber = (res as any).blockNumber ?? null;
      }
    } catch {
      onChainStatus = 'UNANCHORED';
    }

    await this.audit.record({
      entity: 'StaffProfile',
      entityId: staffProfile.id,
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

  async evaluate(staff: any): Promise<StaffIntegrityEvaluation> {
    const snapshot = buildStaffSnapshot(staff);
    const recomputed = staff.dataSalt ? this.audit.recompute(snapshot, staff.dataSalt) : null;
    const dbHash = staff.hash256 || null;
    const onChain = await this.blockchain.getStaffHash(staff.id);
    const onChainNormalized = onChain ? onChain.toLowerCase() : null;
    const recomputedBytes32 = recomputed ? hashToBytes32(recomputed).toLowerCase() : null;

    const dbMatches = recomputed !== null && recomputed === dbHash;
    const chainMatches = recomputedBytes32 !== null && recomputedBytes32 === onChainNormalized;

    let status: 'VERIFIED' | 'TAMPERED' | 'UNANCHORED';
    if (!onChainNormalized) status = 'UNANCHORED';
    else if (chainMatches) status = 'VERIFIED';
    else status = 'TAMPERED';

    return {
      id: staff.id,
      employeeCode: staff.employeeCode,
      fullName: staff.fullName,
      status,
      dbMatches,
      chainMatches,
      recomputedHash: recomputed,
      storedHash: dbHash,
      onChainHash: onChain,
    };
  }

  history(id?: string) {
    return this.audit.history('StaffProfile', id);
  }
}
