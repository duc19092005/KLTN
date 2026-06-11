/** DI token for the step-up ticket issuer port. */
export const STEPUP_TICKET_ISSUER = Symbol('STEPUP_TICKET_ISSUER');

/**
 * Boundary for minting a single-use, action-scoped step-up ticket after a
 * successful biometric re-auth. Wraps the shared StepUpService.issue().
 */
export interface StepUpTicketIssuerPort {
  issue(userId: string, action: string, resourceId?: string | null, ip?: string): Promise<unknown>;
  /** Open a reusable, short-lived privilege session ("sudo mode") for Tier-B sensitive writes. */
  issueSession(userId: string, scope?: string, ip?: string): Promise<unknown>;
}
