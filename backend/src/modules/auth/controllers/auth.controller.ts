import { Body, Controller, Get, Param, Post, Req, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { AuthService } from '../services/auth.service';
import { AuthRateLimiterService } from '../services/auth-rate-limiter.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { AuthUser } from '../../../common/types/auth-user.type';
import {
  BootstrapAdminDto,
  FaceDescriptorDto,
  VerifyFaceDto,
  InviteLoginDto,
  WalletChallengeDto,
  WalletLoginDto,
  WalletVerifyDto,
  StaffLoginDto,
  ChangePasswordDto,
  StepUpFaceDto,
  ForgotPasswordChallengeDto,
  ForgotPasswordVerifyFaceDto,
  ForgotPasswordResetDto,
} from '../dto/auth.dto';
import { getAuthCookieOptions, getClearAuthCookieOptions } from '../constants/auth-security';

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private rateLimiter: AuthRateLimiterService,
  ) {}

  @Post('bootstrap')
  async bootstrapFirstAdmin(
    @Body() body: BootstrapAdminDto,
  ) {
    return this.authService.bootstrapFirstAdmin(
      body.username || 'admin',
      body.email || 'admin@example.local',
      body.superAdminSecret,
    );
  }

  @Post('invite-login')
  async inviteLogin(
    @Body() body: InviteLoginDto,
    @Req() req,
    @Res({ passthrough: true }) res: Response,
  ) {
    const key = this.rateLimitKey(req, 'invite', body.inviteToken.slice(0, 16));
    this.rateLimiter.assertAllowed(key);

    try {
      const result = await this.authService.loginWithInviteToken(body.inviteToken);
      this.rateLimiter.reset(key);
      this.setAuthCookie(res, result.access_token);
      return this.stripToken(result);
    } catch (error) {
      this.rateLimiter.recordFailure(key);
      throw error;
    }
  }

  @Post('staff-login')
  async staffLogin(
    @Body() body: StaffLoginDto,
    @Req() req,
    @Res({ passthrough: true }) res: Response,
  ) {
    const key = this.rateLimitKey(req, 'staff-login', body.username.toLowerCase());
    this.rateLimiter.assertAllowed(key);
    try {
      const result = await this.authService.loginWithPassword(body.username, body.password);
      this.rateLimiter.reset(key);
      this.setAuthCookie(res, result.access_token);
      return this.stripToken(result);
    } catch (error) {
      this.rateLimiter.recordFailure(key);
      throw error;
    }
  }

  @UseGuards(JwtAuthGuard)
  @Post('change-password')
  async changePassword(@CurrentUser() user: AuthUser, @Body() body: ChangePasswordDto) {
    return this.authService.changePassword(user.sub, body.currentPassword, body.newPassword);
  }

  @UseGuards(JwtAuthGuard)
  @Post('register-face')
  async registerFace(@CurrentUser() user: AuthUser, @Body() body: FaceDescriptorDto) {
    return this.authService.registerFace(user.sub, body.embedding);
  }

  @UseGuards(JwtAuthGuard)
  @Post('wallet-bind-challenge')
  async walletBindChallenge(@CurrentUser() user: AuthUser, @Body() body: WalletChallengeDto) {
    return this.authService.walletBindChallenge(user.sub, body.address);
  }

  @UseGuards(JwtAuthGuard)
  @Post('verify-wallet')
  async verifyWallet(
    @CurrentUser() user: AuthUser,
    @Body() body: WalletVerifyDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.verifyWallet(
      user.sub,
      body.address,
      body.signature,
      body.message,
    );
    this.setAuthCookie(res, result.access_token);
    return this.stripToken(result);
  }

  @Get('wallet-challenge/:address')
  async walletChallenge(@Param('address') address: string) {
    return this.authService.walletChallenge(address);
  }

  @Post('wallet-login')
  async walletLogin(
    @Body() body: WalletLoginDto,
    @Req() req,
    @Res({ passthrough: true }) res: Response,
  ) {
    const key = this.rateLimitKey(req, 'wallet', body.walletAddress.toLowerCase());
    this.rateLimiter.assertAllowed(key);

    try {
      const result = await this.authService.walletLogin(
        body.walletAddress,
        body.signature,
        body.message,
      );
      this.rateLimiter.reset(key);
      this.setAuthCookie(res, result.access_token);
      return this.stripToken(result);
    } catch (error) {
      this.rateLimiter.recordFailure(key);
      throw error;
    }
  }

  @UseGuards(JwtAuthGuard)
  @Post('face-challenge')
  async faceChallenge(@CurrentUser() user: AuthUser) {
    return this.authService.createFaceChallenge(user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Post('verify-face')
  async verifyFace(
    @CurrentUser() user: AuthUser,
    @Body() body: VerifyFaceDto,
    @Req() request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const key = this.rateLimitKey(request, 'face', user.sub);
    this.rateLimiter.assertAllowed(key, 5, 10 * 60 * 1000);

    try {
      const result = await this.authService.verifyFace(
        user.sub,
        body.embedding as number[],
        body.challenge,
        user.walletAddress,
        this.clientIp(request),
      );
      this.rateLimiter.reset(key);
      this.setAuthCookie(res, result.access_token);
      return this.stripToken(result);
    } catch (error) {
      this.rateLimiter.recordFailure(key, 10 * 60 * 1000);
      throw error;
    }
  }

  @UseGuards(JwtAuthGuard)
  @Post('face-stepup')
  async faceStepUp(@CurrentUser() user: AuthUser, @Body() body: StepUpFaceDto, @Req() request) {
    // Reuse the biometric rate limiter, keyed per user + action, to throttle scan abuse.
    const key = this.rateLimitKey(request, 'face-stepup', `${user.sub}:${body.action}`);
    this.rateLimiter.assertAllowed(key, 5, 10 * 60 * 1000);

    try {
      const ticket = await this.authService.verifyFaceForStepUp(
        user.sub,
        body.embedding as number[],
        body.challenge,
        body.action,
        body.resourceId ?? null,
        this.clientIp(request),
      );
      this.rateLimiter.reset(key);
      return ticket;
    } catch (error) {
      this.rateLimiter.recordFailure(key, 10 * 60 * 1000);
      throw error;
    }
  }

  @UseGuards(JwtAuthGuard)
  @Post('generate-secret')
  async generateMfaSecret(@CurrentUser() user: AuthUser, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.generateMfaSecret(user.sub);
    this.setAuthCookie(res, result.access_token);
    return this.stripToken(result);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getMe(@CurrentUser() user: AuthUser) {
    return this.authService.getMe(user.sub, Boolean(user.verified));
  }

  @Post('logout')
  async logout(@Req() req, @Res({ passthrough: true }) res: Response) {
    const bearerToken = String(req.headers?.authorization || '').replace(/^Bearer\s+/i, '') || undefined;
    await this.authService.logoutToken(req.cookies?.token || bearerToken);
    res.clearCookie('token', getClearAuthCookieOptions());
    return { success: true };
  }

  private setAuthCookie(res: Response, token?: string) {
    if (!token) return;
    res.cookie('token', token, getAuthCookieOptions());
  }

  private stripToken<T extends { access_token?: string }>(result: T): Omit<T, 'access_token'> {
    const { access_token, ...publicResult } = result;
    return publicResult;
  }

  private rateLimitKey(req: any, action: string, subject: string) {
    const ip = this.clientIp(req);
    return `${action}:${ip}:${subject}`;
  }

  @Post('forgot-password/challenge')
  async forgotPasswordChallenge(@Body() body: ForgotPasswordChallengeDto, @Req() req) {
    const key = this.rateLimitKey(req, 'forgot-challenge', body.username.toLowerCase());
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
    const key = this.rateLimitKey(req, 'forgot-verify', body.userId);
    this.rateLimiter.assertAllowed(key, 5, 5 * 60 * 1000);
    try {
      const result = await this.authService.forgotPasswordVerifyFace(
        body.userId,
        body.embedding,
        body.challenge,
        this.clientIp(req),
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
    const key = this.rateLimitKey(req, 'forgot-reset', 'global');
    this.rateLimiter.assertAllowed(key, 10, 5 * 60 * 1000);
    try {
      const result = await this.authService.forgotPasswordReset(
        body.resetToken,
        body.newPassword,
        this.clientIp(req),
      );
      this.rateLimiter.reset(key);
      return result;
    } catch (error) {
      this.rateLimiter.recordFailure(key, 5 * 60 * 1000);
      throw error;
    }
  }

  private clientIp(req: any): string {
    const forwarded = String(req.headers?.['x-forwarded-for'] || '').split(',')[0].trim();
    return forwarded || req.ip || req.socket?.remoteAddress || 'unknown';
  }
}
