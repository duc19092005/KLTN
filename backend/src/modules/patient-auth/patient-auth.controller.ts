import { Body, Controller, Post, Req } from '@nestjs/common';
import { Request } from 'express';
import { ApiTags } from '@nestjs/swagger';
import { PatientAuthService } from './patient-auth.service';
import { RequestOtpDto, VerifyOtpDto, PatientPasswordLoginDto } from './patient-auth.dto';

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

  private clientIp(req: Request): string {
    const forwarded = String(req.headers?.['x-forwarded-for'] || '').split(',')[0].trim();
    return forwarded || req.ip || req.socket?.remoteAddress || 'unknown';
  }
}
