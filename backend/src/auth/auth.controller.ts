import { Body, Controller, Get, Param, Post, Request, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('bootstrap')
  async bootstrapFirstAdmin(
    @Body() body: { username?: string; email?: string; superAdminSecret: string },
  ) {
    return this.authService.bootstrapFirstAdmin(
      body.username || 'admin',
      body.email || 'admin@example.local',
      body.superAdminSecret,
    );
  }

  @Post('invite-login')
  async inviteLogin(
    @Body() body: { inviteToken: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.loginWithInviteToken(body.inviteToken);
    this.setAuthCookie(res, result.access_token);
    return result;
  }

  @UseGuards(JwtAuthGuard)
  @Post('register-face')
  async registerFace(@Request() req, @Body() body: { embedding: number[] }) {
    return this.authService.registerFace(req.user.sub, body.embedding);
  }

  @UseGuards(JwtAuthGuard)
  @Post('verify-wallet')
  async verifyWallet(
    @Request() req,
    @Body() body: { address: string; signature: string; message: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.verifyWallet(
      req.user.sub,
      body.address,
      body.signature,
      body.message,
    );
    this.setAuthCookie(res, result.access_token);
    return result;
  }

  @Get('wallet-challenge/:address')
  async walletChallenge(@Param('address') address: string) {
    return this.authService.walletChallenge(address);
  }

  @Post('wallet-login')
  async walletLogin(
    @Body() body: { walletAddress: string; signature: string; message: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.walletLogin(
      body.walletAddress,
      body.signature,
      body.message,
    );
    this.setAuthCookie(res, result.access_token);
    return result;
  }

  @UseGuards(JwtAuthGuard)
  @Post('verify-face')
  async verifyFace(
    @Request() req,
    @Body() body: { embedding: number[] },
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.verifyFace(req.user.sub, body.embedding);
    this.setAuthCookie(res, result.access_token);
    return result;
  }

  @UseGuards(JwtAuthGuard)
  @Post('generate-secret')
  async generateMfaSecret(@Request() req) {
    return this.authService.generateMfaSecret(req.user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getMe(@Request() req) {
    return this.authService.getMe(req.user.sub, req.user.verified);
  }

  @Post('logout')
  async logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie('token', { httpOnly: true, secure: false, sameSite: 'lax' });
    return { success: true };
  }

  private setAuthCookie(res: Response, token?: string) {
    if (!token) return;
    res.cookie('token', token, {
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      maxAge: 3600000,
    });
  }
}
