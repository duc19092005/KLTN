import { Global, Module } from '@nestjs/common';
import { StepUpService } from './stepup.service';
import { FaceStepUpGuard } from './face-stepup.guard';

/**
 * Global module exposing the step-up (face re-authentication) primitives:
 *  - StepUpService: mint/consume single-use face tickets.
 *  - FaceStepUpGuard: enforce @RequireFaceStepUp on protected routes.
 *
 * Marked @Global so any feature module can apply @UseGuards(JwtAuthGuard, FaceStepUpGuard) and
 * AuthService can inject StepUpService to mint tickets after a successful face match. PrismaService
 * is provided by the global PrismaModule.
 */
@Global()
@Module({
  providers: [StepUpService, FaceStepUpGuard],
  exports: [StepUpService, FaceStepUpGuard],
})
export class StepUpModule {}
