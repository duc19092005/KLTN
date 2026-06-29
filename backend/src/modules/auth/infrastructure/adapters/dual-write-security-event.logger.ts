import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/prisma/prisma.service';
import { AuditLoggerService } from '../../../../infrastructure/audit/audit-logger.service';
import { SecurityEventLoggerPort } from '../../application/ports/security-event-logger.port';

/**
 * Dual-write security audit adapter. Logic copied verbatim from the former
 * AuthService.writeAudit(): writes to BOTH the queryable AuditLog and the
 * tamper-evident BlockchainLogger (via AuditLoggerService). Both writes are
 * non-fatal so a logging failure never blocks authentication.
 */
@Injectable()
export class DualWriteSecurityEventLogger implements SecurityEventLoggerPort {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLoggerService,
  ) {}

  async write(
    actorId: string | null,
    action: string,
    entity: string,
    entityId: string | null,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: { actorId, action, entity, entityId, metadata: metadata as any },
      });
    } catch (err) {
      console.error('[AuditLog] failed to write', action, err);
    }

    try {
      await this.audit.recordV2({
        entity,
        entityId: entityId ?? 'unknown',
        action,
        actorId,
        before: null,
        after: { metadata: metadata ?? null },
        metadata: { schema: 'KLTN_SECURITY_EVENT_AUDIT_V2' },
      });
    } catch (err) {
      console.error('[BlockchainLogger] failed to write', action, err);
    }
  }
}
