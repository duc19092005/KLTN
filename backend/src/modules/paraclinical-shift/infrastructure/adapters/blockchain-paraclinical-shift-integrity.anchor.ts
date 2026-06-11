import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/prisma/prisma.service';
import { AuditLoggerService } from '../../../../infrastructure/audit/audit-logger.service';
import { AuditAnchorService } from '../../../../infrastructure/audit/audit-anchor.service';

@Injectable()
export class BlockchainParaclinicalShiftIntegrityAnchor {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLoggerService,
    private readonly auditAnchor: AuditAnchorService,
  ) {}

  async evaluate(shift: any): Promise<any> {
    if (shift.status !== 'APPROVED') {
      return {
        id: shift.id,
        status: 'UNANCHORED',
        dbMatches: true,
        chainMatches: true,
        recomputedHash: null,
        storedHash: null,
        onChainHash: null,
      };
    }

    const snapshot = {
      staffId: shift.staffId,
      departmentId: shift.departmentId,
      startTime: shift.startTime.toISOString(),
      endTime: shift.endTime.toISOString(),
      status: 'APPROVED',
    };

    const recomputed = shift.dataSalt ? this.audit.recompute(snapshot, shift.dataSalt) : null;
    const dbHash = shift.hash256 || null;
    const dbMatches = recomputed !== null && recomputed === dbHash;

    const latestLog = await this.prisma.blockchainLogger.findFirst({
      where: { entity: 'ParaclinicalShift', entityId: shift.id, batchId: { not: null } },
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
        chainMatches = false;
      }
    }

    let status: 'VERIFIED' | 'TAMPERED' | 'UNANCHORED';
    if (!latestLog || !latestLog.batchId) status = 'UNANCHORED';
    else if (dbMatches && chainMatches) status = 'VERIFIED';
    else status = 'TAMPERED';

    if (status === 'TAMPERED') {
      const departmentName = shift.department?.name ?? shift.departmentId;
      const staffName = shift.staff?.fullName ?? shift.staffId;
      await this.auditAnchor.sendTelegramAlert(
        'Phát hiện giả mạo lịch trực (Shift)',
        `Ca trực ID: ${shift.id} (Nhân viên: ${staffName}, Phòng ban: ${departmentName})\n` +
          `• Thời gian: ${new Date(shift.startTime).toLocaleString('vi-VN')} - ${new Date(shift.endTime).toLocaleString('vi-VN')}\n` +
          `• Hash CSDL: ${dbHash}\n` +
          `• Hash On-Chain: ${latestLog?.dataHash ?? 'N/A'}\n` +
          `• So khớp DB: ${dbMatches ? 'Khớp' : 'LỆCH'}\n` +
          `• So khớp Chain: ${chainMatches ? 'Khớp' : 'LỆCH'}`,
      );
    }

    return {
      id: shift.id,
      status,
      dbMatches,
      chainMatches,
      recomputedHash: recomputed,
      storedHash: dbHash,
      onChainHash: latestLog?.dataHash ?? null,
    };
  }
}
