import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/prisma/prisma.service';
import { AuditLoggerService } from '../../../../infrastructure/audit/audit-logger.service';
import { SecurityEventLoggerPort } from '../../application/ports/security-event-logger.port';

/**
 * Dual-write security audit adapter.
 * Writes to both the queryable AuditLog and the tamper-evident audit V2 stream.
 * At least one durable channel must succeed; if both fail the call throws so
 * password/security mutations cannot complete silently without an audit trail.
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
    let auditLogOk = false;
    let auditV2Ok = false;

    try {
      await this.prisma.auditLog.create({
        data: { actorId, action, entity, entityId, metadata: metadata as any },
      });
      auditLogOk = true;
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
      auditV2Ok = true;
    } catch (err) {
      console.error('[AuditV2] failed to write', action, err);
    }

    if (!auditLogOk && !auditV2Ok) {
      throw new InternalServerErrorException(
        `Không ghi được nhật ký bảo mật cho sự kiện ${action}.`,
      );
    }
  }
}
