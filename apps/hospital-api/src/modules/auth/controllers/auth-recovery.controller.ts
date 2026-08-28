import { Body, Controller, Post, Req, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { ApiTags } from '@nestjs/swagger';
import { AuthService } from '../services/auth.service';
import { AuthRateLimiterService } from '../services/auth-rate-limiter.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Roles } from '../../../common/decorators/roles.decorator';
import { AuthUser } from '../../../common/types/auth-user.type';
import { RolesGuard } from '../guards/roles.guard';
import {
  ForgotPasswordChallengeDto,
  ForgotPasswordVerifyFaceDto,
  ForgotPasswordResetDto,
  AdminWalletRecoveryVerifyFaceDto,
  AdminWalletRecoveryChallengeDto,
  AdminWalletRecoveryConfirmDto,
  AdminFaceRecoveryRestoreDto,
} from '../dto/auth.dto';
import { getClearAuthCookieOptions } from '../constants/auth-security';
import { clientIp, rateLimitKey, setAuthCookie, stripToken } from './auth-controller.helper';

@ApiTags('Auth Recovery')
@Controller('auth')
export class AuthRecoveryController {
  constructor(
    private readonly authService: AuthService,
    private readonly rateLimiter: AuthRateLimiterService,
  ) {}

  @Post('forgot-password/challenge')
  async forgotPasswordChallenge(@Body() body: ForgotPasswordChallengeDto, @Req() req) {
    const key = rateLimitKey(req, 'forgot-challenge', body.username.toLowerCase());
    this.rateLimiter.assertAllowed(key, 5, 5 * 60 * 1000);
    try {
      const result = await this.authService.forgotPasswordChallenge(body.username);
      this.rateLimiter.reset(key);
      return result;
    } catch (error) {
      this.rateLimiter.recordFailure(key, 5 * 60 * 1000);
      throw error;
    }
  }

  @Post('forgot-password/verify-face')
  async forgotPasswordVerifyFace(@Body() body: ForgotPasswordVerifyFaceDto, @Req() req) {
    const key = rateLimitKey(req, 'forgot-verify', body.userId);
    this.rateLimiter.assertAllowed(key, 5, 5 * 60 * 1000);
    try {
      const result = await this.authService.forgotPasswordVerifyFace(
        body.userId,
        body.embedding,
        body.challenge,
        clientIp(req),
      );
      this.rateLimiter.reset(key);
      return result;
    } catch (error) {
      this.rateLimiter.recordFailure(key, 5 * 60 * 1000);
      throw error;
    }
  }

  @Post('forgot-password/reset')
  async forgotPasswordReset(@Body() body: ForgotPasswordResetDto, @Req() req) {
    const key = rateLimitKey(req, 'forgot-reset', 'global');
    this.rateLimiter.assertAllowed(key, 10, 5 * 60 * 1000);
    try {
      const result = await this.authService.forgotPasswordReset(
        body.resetToken,
        body.newPassword,
        clientIp(req),
      );
      this.rateLimiter.reset(key);
      return result;
    } catch (error) {
      this.rateLimiter.recordFailure(key, 5 * 60 * 1000);
      throw error;
    }
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Post('admin-face-recovery/challenge')
  async adminFaceRecoveryChallenge(@CurrentUser() user: AuthUser, @Req() req) {
    const key = rateLimitKey(req, 'admin-face-recovery-challenge', user.sub);
    this.rateLimiter.assertAllowed(key, 3, 10 * 60 * 1000);
    try {
      const result = await this.authService.adminFaceRecoveryChallenge(user.sub, user.walletAddress);
      this.rateLimiter.recordAttempt(key, 10 * 60 * 1000);
      return result;
    } catch (error) {
      this.rateLimiter.recordFailure(key, 10 * 60 * 1000);
      throw error;
    }
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Post('admin-face-recovery/restore')
  async adminFaceRecoveryRestore(
    @CurrentUser() user: AuthUser,
    @Body() body: AdminFaceRecoveryRestoreDto,
    @Req() req,
    @Res({ passthrough: true }) res: Response,
  ) {
    const key = rateLimitKey(req, 'admin-face-recovery-restore', user.sub);
    this.rateLimiter.assertAllowed(key, 5, 15 * 60 * 1000);
    try {
      const result = await this.authService.adminFaceRecoveryRestore(
        user.sub,
        body.embedding,
        body.challenge,
        user.walletAddress,
        clientIp(req),
      );
      this.rateLimiter.reset(key);
      setAuthCookie(res, result.access_token);
      return stripToken(result);
    } catch (error) {
      this.rateLimiter.recordFailure(key, 15 * 60 * 1000);
      throw error;
    }
  }

  @Post('admin-account-recovery/challenge')
  async adminWalletRecoveryChallenge(@Req() req) {
    const key = rateLimitKey(req, 'admin-recovery-challenge', 'single-admin');
    this.rateLimiter.assertAllowed(key, 3, 10 * 60 * 1000);
    try {
      const result = await this.authService.adminWalletRecoveryChallenge();
      this.rateLimiter.recordAttempt(key, 10 * 60 * 1000);
      return result;
    } catch (error) {
      this.rateLimiter.recordFailure(key, 10 * 60 * 1000);
      throw error;
    }
  }

  @Post('admin-account-recovery/verify-face')
  async adminWalletRecoveryVerifyFace(@Body() body: AdminWalletRecoveryVerifyFaceDto, @Req() req) {
    const key = rateLimitKey(req, 'admin-recovery-face', 'single-admin');
    this.rateLimiter.assertAllowed(key, 5, 15 * 60 * 1000);
    try {
      const result = await this.authService.adminWalletRecoveryVerifyFace(
        body.embedding,
        body.challenge,
        clientIp(req),
      );
      this.rateLimiter.reset(key);
      return result;
    } catch (error) {
      this.rateLimiter.recordFailure(key, 15 * 60 * 1000);
      throw error;
    }
  }

  @Post('admin-account-recovery/wallet-challenge')
  async adminWalletRecoveryWalletChallenge(@Body() body: AdminWalletRecoveryChallengeDto, @Req() req) {
    const key = rateLimitKey(req, 'admin-recovery-wallet', body.address.toLowerCase());
    this.rateLimiter.assertAllowed(key, 5, 10 * 60 * 1000);
    try {
      const result = await this.authService.adminWalletRecoveryWalletChallenge(
        body.recoveryToken,
        body.address,
      );
      this.rateLimiter.reset(key);
      return result;
    } catch (error) {
      this.rateLimiter.recordFailure(key, 10 * 60 * 1000);
      throw error;
    }
  }

  @Post('admin-account-recovery/confirm-wallet')
  async adminWalletRecoveryConfirm(
    @Body() body: AdminWalletRecoveryConfirmDto,
    @Req() req,
    @Res({ passthrough: true }) res: Response,
  ) {
    const key = rateLimitKey(req, 'admin-recovery-confirm', body.address.toLowerCase());
    this.rateLimiter.assertAllowed(key, 5, 10 * 60 * 1000);
    try {
      const result = await this.authService.adminWalletRecoveryConfirm(
        body.recoveryToken,
        body.address,
        body.signature,
        body.message,
        clientIp(req),
      );
      this.rateLimiter.reset(key);
      res.clearCookie('token', getClearAuthCookieOptions());
      return result;
    } catch (error) {
      this.rateLimiter.recordFailure(key, 10 * 60 * 1000);
      throw error;
    }
  }
}