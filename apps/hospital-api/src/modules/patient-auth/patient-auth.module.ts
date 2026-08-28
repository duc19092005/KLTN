import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PrismaModule } from '../../infrastructure/prisma/prisma.module';
import { getJwtSecret } from '../auth/constants/auth-security';
import { AuthRateLimiterService } from '../auth/services/auth-rate-limiter.service';
import { PatientAuthController } from './patient-auth.controller';
import { PatientAuthService } from './patient-auth.service';
import { PatientOtpUseCase } from './application/use-cases/patient-otp.use-case';
import { EsmsService } from './sms/esms.service';

@Module({
  imports: [
    PrismaModule,
    JwtModule.registerAsync({
      useFactory: () => ({
        secret: getJwtSecret(),
        signOptions: { expiresIn: (process.env.JWT_EXPIRATION || '8h') as any },
      }),
    }),
  ],
  controllers: [PatientAuthController],
  providers: [PatientAuthService, PatientOtpUseCase, EsmsService, AuthRateLimiterService],
  exports: [PatientAuthService],
})
export class PatientAuthModule {}
