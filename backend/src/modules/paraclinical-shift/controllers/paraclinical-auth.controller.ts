import { Body, Controller, Post, Res } from '@nestjs/common';
import { Response } from 'express';
import { ParaclinicalLoginUseCase } from '../application/use-cases/paraclinical-login.use-case';
import { VerifyShiftFaceUseCase } from '../application/use-cases/verify-shift-face.use-case';
import { ParaclinicalLoginDto, VerifyShiftFaceDto } from '../dto/paraclinical-auth.dto';
import { getAuthCookieOptions } from '../../auth/constants/auth-security';

/**
 * Two-phase shared-account login controller for paraclinical departments.
 * Phase 1: Username/password → temp token.
 * Phase 2: Temp token + face descriptor → full JWT.
 */
@Controller('auth/paraclinical')
export class ParaclinicalAuthController {
  constructor(
    private readonly paraclinicalLogin: ParaclinicalLoginUseCase,
    private readonly verifyShiftFace: VerifyShiftFaceUseCase,
  ) {}

  /** Phase 1: Validate shared credentials, issue temp token. */
  @Post('login')
  async login(@Body() body: ParaclinicalLoginDto) {
    return this.paraclinicalLogin.execute(body.username, body.password);
  }

  /** Phase 2: Verify face against active shift staff, issue full JWT. */
  @Post('verify-shift-face')
  async verifyFace(@Body() body: VerifyShiftFaceDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.verifyShiftFace.execute(body.tempToken, body.faceDescriptor);
    if (result.access_token) {
      res.cookie('token', result.access_token, getAuthCookieOptions());
    }
    const { access_token, ...publicResult } = result;
    return publicResult;
  }
}
