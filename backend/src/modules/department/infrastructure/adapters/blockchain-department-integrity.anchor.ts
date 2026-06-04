import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/prisma/prisma.service';
import { AuditLoggerService } from '../../../../infrastructure/audit/audit-logger.service';
import { AuditAnchorService } from '../../../../infrastructure/audit/audit-anchor.service';
import {
  DepartmentAnchorAction,
  DepartmentIntegrityAnchorPort,
  DepartmentIntegrityEvaluation,
} from '../../application/ports/department-integrity-anchor.port';
import { buildDepartmentSnapshot } from '../../domain/department-snapshot';

/**
 * Tamper-evidence adapter for departments. Uses the centralized AuditAnchor
 * (Merkle batch) for on-chain integrity verification instead of a dedicated
 * DepartmentRegistry contract. Each change is recorded in BlockchainLogger and
 * periodically anchored on-chain via a Merkle root.
 */
@Injectable()
export class BlockchainDepartmentIntegrityAnchor implements DepartmentIntegrityAnchorPort {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLoggerService,
    private readonly auditAnchor: AuditAnchorService,
  ) {}

  async anchorChange(department: any, action: DepartmentAnchorAction, actorId?: string, before?: unknown): Promise<void> {
    const snapshot = buildDepartmentSnapshot(department);
    let dataHash: string | null = null;
    let dataSalt: string | null = null;

    try {
      if (action !== 'DELETE') {
        const { salt, hash } = this.audit.hashSnapshot(snapshot);
        dataHash = hash;
        dataSalt = salt;
        await this.prisma.department.update({ where: { id: department.id }, data: { hash256: hash, dataSalt: salt } });
      }
    } catch {
      // Hash computation failed; log entry will still be created below with null hashes.
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
      onChainStatus: 'PENDING',
    });
  }

  async evaluate(dept: any): Promise<DepartmentIntegrityEvaluation> {
    const snapshot = buildDepartmentSnapshot(dept);
    const recomputed = dept.dataSalt ? this.audit.recompute(snapshot, dept.dataSalt) : null;
    const dbHash = dept.hash256 || null;
    const dbMatches = recomputed !== null && recomputed === dbHash;

    // Find the latest anchored log entry for this department
    const latestLog = await this.prisma.blockchainLogger.findFirst({
      where: { entity: 'Department', entityId: dept.id, batchId: { not: null } },
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
      } catch {
        // Proof verification failed; chainMatches stays false
      }
    }

    let status: 'VERIFIED' | 'TAMPERED' | 'UNANCHORED';
    if (!latestLog || !latestLog.batchId) status = 'UNANCHORED';
    else if (dbMatches && chainMatches) status = 'VERIFIED';
    else status = 'TAMPERED';

    if (status === 'TAMPERED') {
      await this.auditAnchor.sendTelegramAlert(
        'Phát hiện giả mạo phòng ban',
        `Phòng ban: ${dept.name} (Mã: ${dept.departmentCode}, ID: ${dept.id})\n` +
        `• Hash CSDL: ${dbHash}\n` +
        `• Hash On-Chain: ${latestLog?.dataHash}\n` +
        `• So khớp DB: ${dbMatches ? 'Khớp' : 'LỆCH'}\n` +
        `• So khớp Chain: ${chainMatches ? 'Khớp' : 'LỆCH'}`
      );
    }

    return {
      id: dept.id,
      departmentCode: dept.departmentCode,
      name: dept.name,
      status,
      dbMatches,
      chainMatches,
      recomputedHash: recomputed,
      storedHash: dbHash,
      onChainHash: latestLog?.dataHash ?? null,
    };
  }

  history(id?: string) {
    return this.audit.history('Department', id);
  }
}
