import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/prisma/prisma.service';
import { AuditLoggerService } from '../../../../infrastructure/audit/audit-logger.service';
import { AuditAnchorService } from '../../../../infrastructure/audit/audit-anchor.service';
import {
  StaffIntegrityAnchorPort,
  StaffIntegrityEvaluation,
} from '../../application/ports/staff-integrity-anchor.port';
import { AuditAction } from '../../../../infrastructure/audit/audit-logger.service';
import { buildStaffSnapshot } from '../../domain/staff-snapshot';
import { buildUnifiedDoctorSnapshot } from '../../../doctor/domain/doctor-snapshot';

/**
 * Tamper-evidence adapter for staff profiles. Uses the centralized AuditAnchor
 * (Merkle batch) for on-chain integrity verification instead of a dedicated
 * StaffRegistry contract.
 *
 * When evaluating a staff profile that has a linked doctorProfile, this adapter
 * delegates to the unified doctor snapshot so that the hash matches the one
 * recorded under the doctor's audit log entity.
 */
@Injectable()
export class BlockchainStaffIntegrityAnchor implements StaffIntegrityAnchorPort {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLoggerService,
    private readonly auditAnchor: AuditAnchorService,
  ) {}

  async anchorChange(staff: any, action: AuditAction, actorId?: string, before?: unknown): Promise<void> {
    const snapshot = buildStaffSnapshot(staff);
    let dataHash: string | null = null;
    let dataSalt: string | null = null;

    try {
      if (action !== 'DELETE') {
        const { salt, hash } = this.audit.hashSnapshot(snapshot);
        dataHash = hash;
        dataSalt = salt;
        await this.prisma.staffProfile.update({ where: { id: staff.id }, data: { hash256: hash, dataSalt: salt } });
      }
    } catch {
      // Hash computation failed; log entry will still be created below with null hashes.
    }

    await this.audit.record({
      entity: 'StaffProfile',
      entityId: staff.id,
      action,
      actorId,
      dataHash,
      dataSalt,
      before: before ?? null,
      after: action === 'DELETE' ? null : snapshot,
      onChainStatus: 'PENDING',
    });
  }

  async evaluate(staff: any): Promise<StaffIntegrityEvaluation> {
    // If this staff member is also a doctor, delegate to unified doctor verification
    if (staff.doctorProfile) {
      return this.evaluateDoctor(staff);
    }

    const snapshot = buildStaffSnapshot(staff);
    const recomputed = staff.dataSalt ? this.audit.recompute(snapshot, staff.dataSalt) : null;
    const dbHash = staff.hash256 || null;
    const dbMatches = recomputed !== null && recomputed === dbHash;

    const latestLog = await this.prisma.blockchainLogger.findFirst({
      where: { entity: 'StaffProfile', entityId: staff.id, batchId: { not: null } },
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

    let status: 'VERIFIED' | 'TAMPERED' | 'UNANCHORED';
    if (!latestLog || !latestLog.batchId) status = 'UNANCHORED';
    else if (dbMatches && chainMatches) status = 'VERIFIED';
    else status = 'TAMPERED';

    if (status === 'TAMPERED') {
      await this.auditAnchor.sendTelegramAlert(
        'Phát hiện giả mạo thông tin nhân viên',
        `Nhân viên: ${staff.fullName} (Mã: ${staff.employeeCode}, ID: ${staff.id})\n` +
        `• Hash CSDL: ${dbHash}\n` +
        `• Hash On-Chain: ${latestLog?.dataHash}\n` +
        `• So khớp DB: ${dbMatches ? 'Khớp' : 'LỆCH'}\n` +
        `• So khớp Chain: ${chainMatches ? 'Khớp' : 'LỆCH'}`
      );
    }

    return {
      id: staff.id,
      employeeCode: staff.employeeCode,
      fullName: staff.fullName,
      status,
      dbMatches,
      chainMatches,
      recomputedHash: recomputed,
      storedHash: dbHash,
      onChainHash: latestLog?.dataHash ?? null,
    };
  }

  /**
   * Evaluate a staff member who is also a doctor using the unified doctor snapshot.
   * The doctor's audit log is stored under entity='DoctorProfile', entityId=doctor.id.
   */
  private async evaluateDoctor(staff: any): Promise<StaffIntegrityEvaluation> {
    const doctor = staff.doctorProfile;
    const doctorWithStaff = {
      ...doctor,
      staffProfile: { ...staff, doctorProfile: undefined },
    };
    const snapshot = buildUnifiedDoctorSnapshot(doctorWithStaff);
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

    let status: 'VERIFIED' | 'TAMPERED' | 'UNANCHORED';
    if (!latestLog || !latestLog.batchId) status = 'UNANCHORED';
    else if (dbMatches && chainMatches) status = 'VERIFIED';
    else status = 'TAMPERED';

    if (status === 'TAMPERED') {
      await this.auditAnchor.sendTelegramAlert(
        'Phát hiện giả mạo thông tin bác sĩ (Staff)',
        `Bác sĩ: ${staff.fullName} (Mã: ${staff.employeeCode}, ID: ${staff.id})\n` +
        `• Hash CSDL: ${dbHash}\n` +
        `• Hash On-Chain: ${latestLog?.dataHash}\n` +
        `• So khớp DB: ${dbMatches ? 'Khớp' : 'LỆCH'}\n` +
        `• So khớp Chain: ${chainMatches ? 'Khớp' : 'LỆCH'}`
      );
    }

    return {
      id: staff.id,
      employeeCode: staff.employeeCode,
      fullName: staff.fullName,
      status,
      dbMatches,
      chainMatches,
      recomputedHash: recomputed,
      storedHash: dbHash,
      onChainHash: latestLog?.dataHash ?? null,
    };
  }

  history(id?: string) {
    return this.audit.history('StaffProfile', id);
  }
}
