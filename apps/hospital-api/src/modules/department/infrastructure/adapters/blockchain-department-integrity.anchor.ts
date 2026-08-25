import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/prisma/prisma.service';
import { AuditLoggerService } from '../../../../infrastructure/audit';
import { AuditAnchorService } from '../../../../infrastructure/audit';
import { computeAfterHashV2 } from '../../../../infrastructure/audit';
import {
  DepartmentAnchorAction,
  DepartmentIntegrityAnchorPort,
  DepartmentIntegrityEvaluation,
} from '../../application/ports/department-integrity-anchor.port';
import { buildDepartmentSnapshot } from '../../domain/department-snapshot';
import { Prisma } from '@prisma/client';

/**
 * Tamper-evidence adapter for departments. Each change is recorded in
 * BlockchainLogger and periodically anchored on-chain through AuditAnchor
 * Merkle batches.
 */
@Injectable()
export class BlockchainDepartmentIntegrityAnchor implements DepartmentIntegrityAnchorPort {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLoggerService,
    private readonly auditAnchor: AuditAnchorService,
  ) {}

  async anchorChange(
    department: any,
    action: DepartmentAnchorAction,
    actorId?: string,
    before?: unknown,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    const snapshot = buildDepartmentSnapshot(department);
    const { salt: dataSalt, hash: dataHash } = this.audit.hashSnapshot(snapshot);
    const client = tx ?? this.prisma;
    await client.department.update({ where: { id: department.id }, data: { hash256: dataHash, dataSalt } });

    await this.audit.recordV2({
      entity: 'Department',
      entityId: department.id,
      action,
      actorId,
      before: this.toAuditSnapshot(before),
      after: snapshot,
      onChainStatus: 'PENDING',
    }, tx);
  }

  private toAuditSnapshot(value: unknown): Record<string, unknown> | null {
    if (value == null) return null;
    if (typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>;
    return { value };
  }

  async evaluate(dept: any, skipChainCheck = false): Promise<DepartmentIntegrityEvaluation> {
    const snapshot = buildDepartmentSnapshot(dept);
    const recomputed = dept.dataSalt ? this.audit.recompute(snapshot, dept.dataSalt) : null;
    const dbHash = dept.hash256 || null;
    const dbMatches = recomputed !== null && recomputed === dbHash;
    const currentAfterHash = computeAfterHashV2('Department', dept.id, snapshot);

    const latestAnchored = await this.prisma.blockchainLogger.findFirst({
      where: { entity: 'Department', entityId: dept.id, batchId: { not: null } },
      orderBy: { seq: 'desc' },
      select: { seq: true, afterHash: true, batchId: true },
    });

    const latestAny = await this.prisma.blockchainLogger.findFirst({
      where: { entity: 'Department', entityId: dept.id },
      orderBy: { seq: 'desc' },
      select: { seq: true, afterHash: true, batchId: true },
    });

    let chainMatches = false;
    if (latestAnchored?.seq) {
      if (skipChainCheck) {
        chainMatches = latestAnchored.afterHash === currentAfterHash;
      } else {
        try {
          const proof = await this.auditAnchor.getInclusionProof(latestAnchored.seq);
          if (proof?.verified) chainMatches = latestAnchored.afterHash === currentAfterHash;
        } catch {
          // Proof verification failed; chainMatches stays false.
        }
      }
    }

    let status: 'VERIFIED' | 'TAMPERED' | 'UNANCHORED' | 'PENDING_ANCHOR';
    if (!latestAny) {
      status = 'UNANCHORED';
    } else if (!latestAnchored || (latestAny.seq !== latestAnchored.seq && latestAny.afterHash === currentAfterHash)) {
      status = dbMatches ? 'PENDING_ANCHOR' : 'TAMPERED';
    } else if (dbMatches && chainMatches) {
      status = 'VERIFIED';
    } else {
      status = 'TAMPERED';
    }

    if (status === 'TAMPERED') {
      await this.auditAnchor.sendTelegramAlert(
        'Phát hiện giả mạo phòng ban',
        `Phòng ban: ${dept.name} (Mã: ${dept.departmentCode}, ID: ${dept.id})\n` +
        `• Hash CSDL: ${dbHash}\n` +
        `• Hash Audit đã neo: ${latestAnchored?.afterHash}\n` +
        `• So khớp DB: ${dbMatches ? 'Khớp' : 'LỆCH'}\n` +
        `• So khớp Chain: ${chainMatches ? 'Khớp' : 'LỆCH'}`,
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
      onChainHash: latestAnchored?.afterHash ?? null,
    };
  }

  history(id?: string) {
    return this.audit.history('Department', id);
  }
}
