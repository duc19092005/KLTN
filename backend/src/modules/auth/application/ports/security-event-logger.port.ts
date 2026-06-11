/** DI token for the security event logger port. */
export const SECURITY_EVENT_LOGGER = Symbol('SECURITY_EVENT_LOGGER');

/**
 * Boundary for the dual-write auth/security audit, extracted verbatim from the
 * former AuthService.writeAudit(): writes to BOTH the queryable AuditLog and the
 * tamper-evident BlockchainLogger (via AuditLoggerService). Both writes are
 * non-fatal so a logging failure never blocks authentication.
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
