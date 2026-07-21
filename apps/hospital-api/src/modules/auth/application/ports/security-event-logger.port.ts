/** DI token for the security event logger port. */
export const SECURITY_EVENT_LOGGER = Symbol('SECURITY_EVENT_LOGGER');

/**
 * Boundary for the dual-write auth/security audit: writes to BOTH the queryable
 * AuditLog and the tamper-evident audit V2 stream. At least one durable channel
 * must succeed; dual-failure throws so security mutations cannot complete without
 * an audit trail.
 */
export interface SecurityEventLoggerPort {
  write(
    actorId: string | null,
    action: string,
    entity: string,
    entityId: string | null,
    metadata?: Record<string, unknown>,
  ): Promise<void>;
}
