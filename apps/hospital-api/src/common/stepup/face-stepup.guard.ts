import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { STEPUP_ACTION_KEY } from './require-face-stepup.decorator';
import { StepUpService } from './stepup.service';

/**
 * Guard enforcing face step-up tickets on routes that explicitly require them.
 * If a route has no @RequireFaceStepUp decorator, the guard is a no-op.
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
    if (!action) return true;

    const req = context.switchToHttp().getRequest();
    const userId = req.user?.sub;
    const token = req.headers?.['x-stepup-ticket'] as string | undefined;
    const resourceId = req.params?.id ?? req.params?.seq ?? req.params?.batchId ?? null;
    const ip = String(req.headers?.['x-forwarded-for'] || '').split(',')[0].trim() || req.ip;
    await this.stepUp.consume({ userId, action, token, resourceId, ip });
    req.stepUp = { verified: true, mode: 'TICKET', action, resourceId };
    return true;
  }
}
