import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { AuthUser } from '../../../common/types/auth-user.type';
import { InitiateHandoverUseCase } from '../application/use-cases/initiate-handover.use-case';
import { VerifyHandoverFaceAUseCase } from '../application/use-cases/verify-handover-face-a.use-case';
import { VerifyHandoverFaceBUseCase } from '../application/use-cases/verify-handover-face-b.use-case';
import { InitiateHandoverDto, VerifyHandoverFaceDto } from '../dto/handover.dto';

@Controller('paraclinical/handover')
export class HandoverController {
  constructor(
    private readonly initiateHandover: InitiateHandoverUseCase,
    private readonly verifyFaceA: VerifyHandoverFaceAUseCase,
    private readonly verifyFaceB: VerifyHandoverFaceBUseCase,
  ) {}

  /** Initiate a handover. The current user is the outgoing staff. */
  @UseGuards(JwtAuthGuard)
  @Post('initiate')
  async initiate(@CurrentUser() user: AuthUser, @Body() body: InitiateHandoverDto) {
    const fromStaffId = (user as any).staffId || user.sub;
    return this.initiateHandover.execute(
      fromStaffId,
      body.toStaffId,
      body.departmentId,
      body.reason,
    );
  }

  /** Verify face of Person A (outgoing staff). */
  @UseGuards(JwtAuthGuard)
  @Post('verify-face-a')
  async faceA(@Body() body: VerifyHandoverFaceDto) {
    return this.verifyFaceA.execute(body.handoverId, body.faceDescriptor);
  }

  /** Verify face of Person B (incoming staff). Completes the handover + blockchain anchor. */
  @UseGuards(JwtAuthGuard)
  @Post('verify-face-b')
  async faceB(@Body() body: VerifyHandoverFaceDto) {
    return this.verifyFaceB.execute(body.handoverId, body.faceDescriptor);
  }
}
