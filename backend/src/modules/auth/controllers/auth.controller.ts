import { Body, Controller, Get, Param, Post, Req, Request, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { AuthService } from '../services/auth.service';
import { AuthRateLimiterService } from '../services/auth-rate-limiter.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
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
  async changePassword(@Request() req, @Body() body: ChangePasswordDto) {
    return this.authService.changePassword(req.user.sub, body.currentPassword, body.newPassword);
  }

  @UseGuards(JwtAuthGuard)
  @Post('register-face')
  async registerFace(@Request() req, @Body() body: FaceDescriptorDto) {
    return this.authService.registerFace(req.user.sub, body.embedding);
  }

  @UseGuards(JwtAuthGuard)
  @Post('wallet-bind-challenge')
  async walletBindChallenge(@Request() req, @Body() body: WalletChallengeDto) {
    return this.authService.walletBindChallenge(req.user.sub, body.address);
  }

  @UseGuards(JwtAuthGuard)
  @Post('verify-wallet')
  async verifyWallet(
    @Request() req,
    @Body() body: WalletVerifyDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.verifyWallet(
      req.user.sub,
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
  async faceChallenge(@Request() req) {
    return this.authService.createFaceChallenge(req.user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Post('verify-face')
  async verifyFace(
    @Request() req,
    @Body() body: VerifyFaceDto,
    @Req() request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const key = this.rateLimitKey(request, 'face', req.user.sub);
    this.rateLimiter.assertAllowed(key, 5, 10 * 60 * 1000);

    try {
      const result = await this.authService.verifyFace(
        req.user.sub,
        body.embedding as number[],
        body.challenge,
        req.user.walletAddress,
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
  @Post('generate-secret')
  async generateMfaSecret(@Request() req, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.generateMfaSecret(req.user.sub);
    this.setAuthCookie(res, result.access_token);
    return this.stripToken(result);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getMe(@Request() req) {
    return this.authService.getMe(req.user.sub, req.user.verified);
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

  private clientIp(req: any): string {
    const forwarded = String(req.headers?.['x-forwarded-for'] || '').split(',')[0].trim();
    return forwarded || req.ip || req.socket?.remoteAddress || 'unknown';
  }
}
