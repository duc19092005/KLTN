import { Body, Controller, Get, Param, Post, Req, Request, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { AuthService } from './auth.service';
import { AuthRateLimiterService } from './auth-rate-limiter.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import {
  BootstrapAdminDto,
  FaceDescriptorDto,
  InviteLoginDto,
  WalletChallengeDto,
  WalletLoginDto,
  WalletVerifyDto,
} from './auth.dto';
import { getAuthCookieOptions, getClearAuthCookieOptions } from './auth-security';

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
  @Post('verify-face')
  async verifyFace(
    @Request() req,
    @Body() body: FaceDescriptorDto,
    @Req() request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const key = this.rateLimitKey(request, 'face', req.user.sub);
    this.rateLimiter.assertAllowed(key, 5, 10 * 60 * 1000);

    try {
      const result = await this.authService.verifyFace(req.user.sub, body.embedding as number[], req.user.walletAddress);
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
    const forwarded = String(req.headers?.['x-forwarded-for'] || '').split(',')[0].trim();
    const ip = forwarded || req.ip || req.socket?.remoteAddress || 'unknown';
    return `${action}:${ip}:${subject}`;
  }
}
