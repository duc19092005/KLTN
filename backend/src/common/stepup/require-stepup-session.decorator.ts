import { SetMetadata } from '@nestjs/common';

export const STEPUP_SESSION_SCOPE_KEY = 'stepup:session-scope';

/**
 * Marks a route as requiring an active step-up SESSION ("sudo mode") rather than a fresh per-action
 * face scan. The client opens a session once via POST /auth/stepup-session (after a face match) and
 * replays the returned token via the `x-stepup-session` header on every Tier-B sensitive write.
 *
 * Difference vs @RequireFaceStepUp(action):
 *   - @RequireFaceStepUp  -> single-use ticket, bound to one record. Use for Tier-A (delete /
 *                            restore / anchor) where every action must be individually re-verified.
 *   - @RequireStepUpSession -> reusable short-lived session. Use for Tier-B (create/update) done
 *                            repeatedly, so users are not forced to re-scan for each record.
 *
 * On a missing/expired session the guard throws 403 with code STEPUP_SESSION_REQUIRED, which the
 * frontend interceptor catches to prompt a scan and transparently retry the original request.
 *
 * @param scope  Logical session scope (default 'SENSITIVE_WRITE'). A session is valid only for the
 *               scope it was opened for.
 */
export const RequireStepUpSession = (scope = 'SENSITIVE_WRITE') =>
  SetMetadata(STEPUP_SESSION_SCOPE_KEY, scope);
