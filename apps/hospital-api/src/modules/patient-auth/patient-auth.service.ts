import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { hashPassword, verifyPassword } from '../auth/domain/credential.util';
import { INVALID_CREDENTIAL_MESSAGE, OtpResponse, normalizeVietnamPhone } from './domain/patient-phone.util';
import { PatientOtpUseCase } from './application/use-cases/patient-otp.use-case';

@Injectable()
export class PatientAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly otpUseCase: PatientOtpUseCase,
  ) {}

  async requestOtp(phoneInput: string, ipAddress?: string, userAgent?: string): Promise<OtpResponse> {
    return this.otpUseCase.requestOtp(phoneInput, ipAddress, userAgent);
  }

  async resendOtp(phoneInput: string, ipAddress?: string, userAgent?: string): Promise<OtpResponse> {
    return this.otpUseCase.resendOtp(phoneInput, ipAddress, userAgent);
  }

  async verifyOtp(phoneInput: string, otp: string, newPassword?: string) {
    return this.otpUseCase.verifyOtp(phoneInput, otp, newPassword);
  }

  async passwordLogin(phoneInput: string, password: string) {
    const phoneNormalized = normalizeVietnamPhone(phoneInput);
    const user = await this.prisma.user.findUnique({
      where: { phoneNormalized },
      include: { patientAccesses: { where: { status: 'ACTIVE' }, include: { patient: true } } },
    });

    if (!user || user.role !== 'PATIENT' || user.status !== 'ACTIVE' || !user.passwordHash) {
      throw new UnauthorizedException(INVALID_CREDENTIAL_MESSAGE);
    }
    if (!verifyPassword(password, user.passwordHash)) {
      throw new UnauthorizedException(INVALID_CREDENTIAL_MESSAGE);
    }

    const patients = user.patientAccesses.map((access) => access.patient);
    return this.otpUseCase.buildLoginResponse(user.id, phoneNormalized, patients);
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    if (currentPassword === newPassword) {
      throw new BadRequestException('Mật khẩu mới không được trùng mật khẩu hiện tại.');
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.role !== 'PATIENT' || user.status !== 'ACTIVE' || !user.passwordHash) {
      throw new UnauthorizedException(INVALID_CREDENTIAL_MESSAGE);
    }
    if (!verifyPassword(currentPassword, user.passwordHash)) {
      throw new UnauthorizedException(INVALID_CREDENTIAL_MESSAGE);
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: hashPassword(newPassword),
        tokenVersion: { increment: 1 },
        firstLogin: false,
        registrationStep: 2,
      },
    });

    return { success: true, message: 'Đã đổi mật khẩu thành công. Vui lòng đăng nhập lại.' };
  }
}