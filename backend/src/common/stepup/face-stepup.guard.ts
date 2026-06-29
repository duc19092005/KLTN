import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { STEPUP_ACTION_KEY } from './require-face-stepup.decorator';
import { STEPUP_SESSION_SCOPE_KEY } from './require-stepup-session.decorator';
import { StepUpService } from './stepup.service';

/**
 * Guard enforcing either step-up mode on a route, runs AFTER JwtAuthGuard (so req.user is set):
 *
 *  - @RequireFaceStepUp(action)   -> consumes a single-use ticket from `x-stepup-ticket`, bound to
 *                                    the route's :id/:seq param. For Tier-A (delete/restore/anchor).
 *  - @RequireStepUpSession(scope) -> validates a reusable session from `x-stepup-session` and slides
 *                                    its idle window. For Tier-B (repeated create/update). On a
 *                                    missing/expired session it throws 403 STEPUP_SESSION_REQUIRED.
 *
 * If a route has neither decorator, the guard is a no-op (returns true), so it is safe to register
 * per-controller without affecting non-sensitive endpoints.
 */
@Injectable()
export class FaceStepUpGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly stepUp: StepUpService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const action = this.reflector.getAllAndOverride<string | undefined>(STEPUP_ACTION_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const sessionScope = this.reflector.getAllAndOverride<string | undefined>(STEPUP_SESSION_SCOPE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!action && !sessionScope) return true; // route is not step-up protected

    const req = context.switchToHttp().getRequest();
    const userId = req.user?.sub;

    // Session mode (Tier-B): reusable privilege window.
    if (sessionScope) {
      const token = req.headers?.['x-stepup-session'] as string | undefined;
      await this.stepUp.consumeSession({ userId, scope: sessionScope, token });
      req.stepUp = { verified: true, mode: 'SESSION', scope: sessionScope, resourceId: null };
      return true;
    }

    // Single-use mode (Tier-A): fresh face scan bound to this record.
    const token = req.headers?.['x-stepup-ticket'] as string | undefined;
    const resourceId = req.params?.id ?? req.params?.seq ?? null;
    const ip = String(req.headers?.['x-forwarded-for'] || '').split(',')[0].trim() || req.ip;
    await this.stepUp.consume({ userId, action: action as string, token, resourceId, ip });
    req.stepUp = { verified: true, mode: 'TICKET', action, resourceId };
    return true;
  }
}
