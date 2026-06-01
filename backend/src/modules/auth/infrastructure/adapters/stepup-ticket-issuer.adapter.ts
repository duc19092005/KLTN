import { Injectable } from '@nestjs/common';
import { StepUpService } from '../../../../common/stepup/stepup.service';
import { StepUpTicketIssuerPort } from '../../application/ports/stepup-ticket-issuer.port';

/**
 * Adapter binding the step-up ticket issuer port to the shared StepUpService.
 * Behavior delegated 1:1 to StepUpService.issue().
 */
@Injectable()
export class StepUpTicketIssuerAdapter implements StepUpTicketIssuerPort {
  constructor(private readonly stepUp: StepUpService) {}

  issue(userId: string, action: string, resourceId?: string | null, ip?: string): Promise<unknown> {
    return this.stepUp.issue(userId, action, resourceId ?? null, ip);
  }
}
