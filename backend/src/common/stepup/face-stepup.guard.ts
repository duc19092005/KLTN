import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { STEPUP_ACTION_KEY } from './require-face-stepup.decorator';
import { StepUpService } from './stepup.service';

/**
 * Guard that enforces @RequireFaceStepUp(action) on a route. Runs AFTER JwtAuthGuard (so req.user
 * is populated) and consumes the single-use ticket supplied in the `x-stepup-ticket` header.
 *
 * If the route has no @RequireFaceStepUp metadata, the guard is a no-op (returns true), so it is
 * safe to register globally or per-controller without affecting non-sensitive endpoints.
 *
 * The ticket is bound to the route's resource id (`:id` or `:seq` param) when present, so a ticket
 * minted for one record cannot be replayed against another. consume() throws ForbiddenException on
 * any mismatch / expiry / reuse, which surfaces as HTTP 403.
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
    if (!action) return true; // route is not step-up protected

    const req = context.switchToHttp().getRequest();
    const userId = req.user?.sub;
    const token = req.headers?.['x-stepup-ticket'] as string | undefined;
    const resourceId = req.params?.id ?? req.params?.seq ?? null;
    const ip = String(req.headers?.['x-forwarded-for'] || '').split(',')[0].trim() || req.ip;

    await this.stepUp.consume({ userId, action, token, resourceId, ip });
    return true;
  }
}
