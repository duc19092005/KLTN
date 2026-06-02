import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/prisma/prisma.service';
import { BlockchainService } from '../../../../infrastructure/blockchain/blockchain.service';
import { AuditLoggerService } from '../../../../infrastructure/audit/audit-logger.service';
import { hashToBytes32 } from '../../../../infrastructure/audit/audit-hash.util';
import {
  DoctorAnchorAction,
  DoctorIntegrityAnchorPort,
  DoctorIntegrityEvaluation,
} from '../../application/ports/doctor-integrity-anchor.port';
import { buildUnifiedDoctorSnapshot } from '../../domain/doctor-snapshot';

/**
 * Tamper-evidence adapter for doctors. Logic copied verbatim from the former
 * DoctorService (anchorDoctorChange, evaluateIntegrity, getHistory): unified
 * staff+doctor hash, on-chain mirror via StaffRegistry under doctor.id,
 * hash256/dataSalt persistence on DoctorProfile, and the BlockchainLogger audit
 * entry. Only the salted hash goes on-chain.
 */
@Injectable()
export class BlockchainDoctorIntegrityAnchor implements DoctorIntegrityAnchorPort {
  constructor(
    private readonly prisma: PrismaService,
    private readonly blockchain: BlockchainService,
    private readonly audit: AuditLoggerService,
  ) {}

  async anchorChange(doctor: any, action: DoctorAnchorAction, actorId?: string, before?: unknown): Promise<void> {
    const snapshot = buildUnifiedDoctorSnapshot(doctor);
    let dataHash: string | null = null;
    let dataSalt: string | null = null;
    let onChainStatus = 'PENDING';
    let txHash: string | null = null;
    let blockNumber: number | null = null;

    try {
      if (action === 'DELETE') {
        const res = await this.blockchain.removeStaffHash(doctor.id);
        onChainStatus = res.success ? 'ANCHORED' : 'UNANCHORED';
        txHash = (res as any).txHash ?? null;
        blockNumber = (res as any).blockNumber ?? null;
      } else {
        const { salt, hash } = this.audit.hashSnapshot(snapshot);
        dataHash = hash;
        dataSalt = salt;
        await this.prisma.doctorProfile.update({ where: { id: doctor.id }, data: { hash256: hash, dataSalt: salt } });
        const res = await this.blockchain.setStaffHash(doctor.id, hashToBytes32(hash));
        onChainStatus = res.success ? 'ANCHORED' : 'UNANCHORED';
        txHash = (res as any).txHash ?? null;
        blockNumber = (res as any).blockNumber ?? null;
      }
    } catch (err) {
      console.error('Error anchoring doctor change:', err);
      onChainStatus = 'UNANCHORED';
    }

    await this.audit.record({
      entity: 'DoctorProfile',
      entityId: doctor.id,
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

  async evaluate(doctor: any): Promise<DoctorIntegrityEvaluation> {
    const snapshot = buildUnifiedDoctorSnapshot(doctor);
    const recomputed = doctor.dataSalt ? this.audit.recompute(snapshot, doctor.dataSalt) : null;
    const dbHash = doctor.hash256 || null;
    const onChain = await this.blockchain.getStaffHash(doctor.id);
    const onChainNormalized = onChain ? onChain.toLowerCase() : null;
    const recomputedBytes32 = recomputed ? hashToBytes32(recomputed).toLowerCase() : null;

    const dbMatches = recomputed !== null && recomputed === dbHash;
    const chainMatches = recomputedBytes32 !== null && recomputedBytes32 === onChainNormalized;

    let status: 'VERIFIED' | 'TAMPERED' | 'UNANCHORED';
    if (!onChainNormalized) status = 'UNANCHORED';
    else if (chainMatches) status = 'VERIFIED';
    else status = 'TAMPERED';

    return {
      id: doctor.id,
      staffProfileId: doctor.staffProfileId,
      specialty: doctor.specialty,
      licenseNumber: doctor.licenseNumber,
      status,
      dbMatches,
      chainMatches,
      recomputedHash: recomputed,
      storedHash: dbHash,
      onChainHash: onChain,
    };
  }

  history(id?: string) {
    return this.audit.history('DoctorProfile', id);
  }
}
