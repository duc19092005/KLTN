import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthUser } from '../../common/types/auth-user.type';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PatientAuthService } from './patient-auth.service';
import { RequestOtpDto, VerifyOtpDto, PatientPasswordLoginDto, PatientChangePasswordDto } from './patient-auth.dto';

@ApiTags('Patient Auth')
@Controller('patient/auth')
export class PatientAuthController {
  constructor(private readonly patientAuthService: PatientAuthService) {}

  @Post('request-otp')
  requestOtp(@Body() dto: RequestOtpDto, @Req() req: Request) {
    return this.patientAuthService.requestOtp(dto.phone, this.clientIp(req), req.headers['user-agent']);
  }

  @Post('resend-otp')
  resendOtp(@Body() dto: RequestOtpDto, @Req() req: Request) {
    return this.patientAuthService.resendOtp(dto.phone, this.clientIp(req), req.headers['user-agent']);
  }

  @Post('verify-otp')
  verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.patientAuthService.verifyOtp(dto.phone, dto.otp, dto.newPassword);
  }

  @Post('password-login')
  passwordLogin(@Body() dto: PatientPasswordLoginDto) {
    return this.patientAuthService.passwordLogin(dto.phone, dto.password);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('PATIENT')
  @Post('change-password')
  changePassword(@CurrentUser() user: AuthUser, @Body() dto: PatientChangePasswordDto) {
    return this.patientAuthService.changePassword(user.sub, dto.currentPassword, dto.newPassword);
  }

  private clientIp(req: Request): string {
    const forwarded = String(req.headers?.['x-forwarded-for'] || '').split(',')[0].trim();
    return forwarded || req.ip || req.socket?.remoteAddress || 'unknown';
  }
}
