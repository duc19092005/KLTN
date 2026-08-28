import { Body, Controller, Get, Param, Post, Req, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { ApiTags } from '@nestjs/swagger';
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
  FaceLoginChallengeDto,
  FaceLoginDto,
} from '../dto/auth.dto';
import { getClearAuthCookieOptions } from '../constants/auth-security';
import { clientIp, rateLimitKey, setAuthCookie, stripToken } from './auth-controller.helper';

@ApiTags('Authentication')
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
      body.bootstrapSecret || body.superAdminSecret,
    );
  }

  @Post('invite-login')
  async inviteLogin(
    @Body() body: InviteLoginDto,
    @Req() req,
    @Res({ passthrough: true }) res: Response,
  ) {
    const key = rateLimitKey(req, 'invite', body.inviteToken.slice(0, 16));
    this.rateLimiter.assertAllowed(key);

    try {
      const result = await this.authService.loginWithInviteToken(body.inviteToken);
      this.rateLimiter.reset(key);
      setAuthCookie(res, result.access_token);
      return stripToken(result);
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
    const key = rateLimitKey(req, 'staff-login', body.username.toLowerCase());
    this.rateLimiter.assertAllowed(key);
    try {
      const result = await this.authService.loginWithPassword(body.username, body.password);
      this.rateLimiter.reset(key);
      setAuthCookie(res, result.access_token);
      return stripToken(result);
    } catch (error) {
      this.rateLimiter.recordFailure(key);
      throw error;
    }
  }

  @UseGuards(JwtAuthGuard)
  @Post('change-password')
  async changePassword(
    @CurrentUser() user: AuthUser,
    @Body() body: ChangePasswordDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.changePassword(user.sub, body.currentPassword, body.newPassword);
    if ('access_token' in result && result.access_token) {
      setAuthCookie(res, result.access_token);
    }
    return stripToken(result as any);
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
    setAuthCookie(res, result.access_token);
    return stripToken(result);
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
    const key = rateLimitKey(req, 'wallet', body.walletAddress.toLowerCase());
    this.rateLimiter.assertAllowed(key);

    try {
      const result = await this.authService.walletLogin(
        body.walletAddress,
        body.signature,
        body.message,
      );
      this.rateLimiter.reset(key);
      setAuthCookie(res, result.access_token);
      return stripToken(result);
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
    const key = rateLimitKey(request, 'face', user.sub);
    this.rateLimiter.assertAllowed(key, 5, 10 * 60 * 1000);

    try {
      const result = await this.authService.verifyFace(
        user.sub,
        body.embedding as number[],
        body.challenge,
        user.walletAddress,
        clientIp(request),
      );
      this.rateLimiter.reset(key);
      setAuthCookie(res, result.access_token);
      return stripToken(result);
    } catch (error) {
      this.rateLimiter.recordFailure(key, 10 * 60 * 1000);
      throw error;
    }
  }

  @UseGuards(JwtAuthGuard)
  @Post('face-stepup')
  async faceStepUp(@CurrentUser() user: AuthUser, @Body() body: StepUpFaceDto, @Req() request) {
    const key = rateLimitKey(request, 'face-stepup', `${user.sub}:${body.action}`);
    this.rateLimiter.assertAllowed(key, 5, 10 * 60 * 1000);

    try {
      const ticket = await this.authService.verifyFaceForStepUp(
        user.sub,
        body.embedding as number[],
        body.challenge,
        body.action,
        body.resourceId ?? null,
        clientIp(request),
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
    setAuthCookie(res, result.access_token);
    return stripToken(result);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getMe(@CurrentUser() user: AuthUser) {
    return this.authService.getMe(user.sub, Boolean(user.verified));
  }

  @UseGuards(JwtAuthGuard)
  @Get('profile')
  async getProfile(@CurrentUser() user: AuthUser) {
    return this.authService.getMyProfile(user.sub);
  }

  @Post('logout')
  async logout(@Req() req, @Res({ passthrough: true }) res: Response) {
    const bearerToken = String(req.headers?.authorization || '').replace(/^Bearer\s+/i, '') || undefined;
    await this.authService.logoutToken(req.cookies?.token || bearerToken);
    res.clearCookie('token', getClearAuthCookieOptions());
    return { success: true };
  }

  @Post('face-login/challenge')
  async faceLoginChallenge(@Body() body: FaceLoginChallengeDto, @Req() req) {
    const key = rateLimitKey(req, 'face-login-challenge', body.username.toLowerCase());
    this.rateLimiter.assertAllowed(key, 5, 5 * 60 * 1000);
    try {
      const result = await this.authService.faceLoginChallenge(body.username);
      this.rateLimiter.reset(key);
      return result;
    } catch (error) {
      this.rateLimiter.recordFailure(key, 5 * 60 * 1000);
      throw error;
    }
  }

  @Post('face-login')
  async faceLogin(
    @Body() body: FaceLoginDto,
    @Req() req,
    @Res({ passthrough: true }) res: Response,
  ) {
    const key = rateLimitKey(req, 'face-login-verify', body.userId);
    this.rateLimiter.assertAllowed(key, 5, 5 * 60 * 1000);
    try {
      const result = await this.authService.faceLogin(
        body.userId,
        body.embedding,
        body.challenge,
        clientIp(req),
      );
      this.rateLimiter.reset(key);
      setAuthCookie(res, result.access_token);
      return stripToken(result);
    } catch (error) {
      this.rateLimiter.recordFailure(key, 5 * 60 * 1000);
      throw error;
    }
  }
}