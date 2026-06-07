import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/prisma/prisma.service';
import { AuditLoggerService } from '../../../../infrastructure/audit/audit-logger.service';
import { AuditAnchorService } from '../../../../infrastructure/audit/audit-anchor.service';
import {
  DoctorAnchorAction,
  DoctorIntegrityAnchorPort,
  DoctorIntegrityEvaluation,
} from '../../application/ports/doctor-integrity-anchor.port';
import { buildUnifiedDoctorSnapshot } from '../../domain/doctor-snapshot';

/**
 * Tamper-evidence adapter for doctors. Uses the centralized AuditAnchor
 * (Merkle batch) for on-chain integrity verification instead of a dedicated
 * StaffRegistry contract. Unified staff+doctor snapshot is hashed, persisted
 * on DoctorProfile, and recorded in BlockchainLogger.
 */
@Injectable()
export class BlockchainDoctorIntegrityAnchor implements DoctorIntegrityAnchorPort {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLoggerService,
    private readonly auditAnchor: AuditAnchorService,
  ) {}

  async anchorChange(doctor: any, action: DoctorAnchorAction, actorId?: string, before?: unknown): Promise<void> {
    const snapshot = buildUnifiedDoctorSnapshot(doctor);
    let dataHash: string | null = null;
    let dataSalt: string | null = null;

    try {
      if (action !== 'DELETE') {
        const { salt, hash } = this.audit.hashSnapshot(snapshot);
        dataHash = hash;
        dataSalt = salt;
        await this.prisma.doctorProfile.update({ where: { id: doctor.id }, data: { hash256: hash, dataSalt: salt } });
      }
    } catch (err) {
      console.error('Error computing doctor hash:', err);
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
      onChainStatus: 'PENDING',
    });
  }

  async evaluate(doctor: any): Promise<DoctorIntegrityEvaluation> {
    const snapshot = buildUnifiedDoctorSnapshot(doctor);
    const recomputed = doctor.dataSalt ? this.audit.recompute(snapshot, doctor.dataSalt) : null;
    const dbHash = doctor.hash256 || null;
    const dbMatches = recomputed !== null && recomputed === dbHash;

    const latestLog = await this.prisma.blockchainLogger.findFirst({
      where: { entity: 'DoctorProfile', entityId: doctor.id, batchId: { not: null } },
      orderBy: { seq: 'desc' },
      select: { seq: true, dataHash: true, batchId: true },
    });

    let chainMatches = false;
    if (latestLog?.seq) {
      try {
        const proof = await this.auditAnchor.getInclusionProof(latestLog.seq);
        if (proof && proof.verified) {
          chainMatches = latestLog.dataHash === recomputed;
        }
      } catch { /* proof verification failed */ }
    }

    // Latest log entry overall (regardless of anchor status). Used to detect the window
    // between a write and the next Merkle batch (anchored every ~5 min) so we don't
    // mislabel a freshly-edited-but-not-yet-anchored record as TAMPERED.
    const latestAny = await this.prisma.blockchainLogger.findFirst({
      where: { entity: 'DoctorProfile', entityId: doctor.id },
      orderBy: { seq: 'desc' },
      select: { seq: true, dataHash: true, batchId: true },
    });

    let status: 'VERIFIED' | 'TAMPERED' | 'UNANCHORED' | 'PENDING_ANCHOR';
    if (!latestAny) {
      status = 'UNANCHORED';
    } else if (!latestLog || (latestAny.seq !== latestLog.seq && latestAny.dataHash === recomputed)) {
      // A newer (or first-ever) log exists that isn't anchored yet, and its hash matches the
      // current DB row → the write is just waiting for the next Merkle batch. Not tampering.
      status = dbMatches ? 'PENDING_ANCHOR' : 'TAMPERED';
    } else if (dbMatches && chainMatches) {
      status = 'VERIFIED';
    } else {
      status = 'TAMPERED';
    }

    if (status === 'TAMPERED') {
      await this.auditAnchor.sendTelegramAlert(
        'Phát hiện giả mạo thông tin bác sĩ',
        `Bác sĩ ID: ${doctor.id} (Chuyên khoa: ${doctor.specialty}, Số CCHN: ${doctor.licenseNumber})\n` +
        `• Hash CSDL: ${dbHash}\n` +
        `• Hash On-Chain: ${latestLog?.dataHash}\n` +
        `• So khớp DB: ${dbMatches ? 'Khớp' : 'LỆCH'}\n` +
        `• So khớp Chain: ${chainMatches ? 'Khớp' : 'LỆCH'}`
      );
    }

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
      onChainHash: latestLog?.dataHash ?? null,
    };
  }

  history(id?: string) {
    return this.audit.history('DoctorProfile', id);
  }
}
