import * as crypto from 'crypto';
import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { hashPassword, verifyPassword } from '../auth/domain/credential.util';
import { AuthRateLimiterService } from '../auth/services/auth-rate-limiter.service';
import { EsmsService } from './sms/esms.service';

const OTP_TTL_MS = 5 * 60 * 1000;
const OTP_RESEND_COOLDOWN_MS = 60 * 1000;
const OTP_LENGTH = 6;
const PATIENT_LOGIN_MESSAGE = 'Nếu số điện thoại hợp lệ, OTP sẽ được gửi.';
const PATIENT_RESEND_MESSAGE = 'Nếu số điện thoại hợp lệ, OTP mới sẽ được gửi khi hết thời gian chờ.';
const INVALID_CREDENTIAL_MESSAGE = 'Số điện thoại hoặc thông tin xác thực không hợp lệ.';

type PatientLoginRecord = {
  id: string;
  patientCode: string;
  fullName: string;
  phone: string | null;
};

type OtpResponse = {
  success: true;
  message: string;
  resendAfterSeconds: number;
  canResendAt: string;
  otpExpiresAt: string;
};

@Injectable()
export class PatientAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly smsService: EsmsService,
    private readonly rateLimiter: AuthRateLimiterService,
  ) {}

  async requestOtp(phoneInput: string, ipAddress?: string, userAgent?: string): Promise<OtpResponse> {
    return this.issueOtp(phoneInput, PATIENT_LOGIN_MESSAGE, ipAddress, userAgent);
  }

  async resendOtp(phoneInput: string, ipAddress?: string, userAgent?: string): Promise<OtpResponse> {
    return this.issueOtp(phoneInput, PATIENT_RESEND_MESSAGE, ipAddress, userAgent);
  }

  async verifyOtp(phoneInput: string, otp: string, newPassword?: string) {
    const phoneNormalized = this.normalizeVietnamPhone(phoneInput);
    const record = await this.prisma.otpVerification.findFirst({
      where: {
        phoneNormalized,
        purpose: 'PATIENT_LOGIN',
        usedAt: null,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!record || record.expiresAt.getTime() < Date.now() || record.attempts >= record.maxAttempts) {
      throw new UnauthorizedException('OTP không hợp lệ hoặc đã hết hạn.');
    }

    const expectedHash = this.hashOtp(phoneNormalized, otp);
    if (!crypto.timingSafeEqual(Buffer.from(record.otpHash), Buffer.from(expectedHash))) {
      await this.prisma.otpVerification.update({
        where: { id: record.id },
        data: { attempts: { increment: 1 } },
      });
      throw new UnauthorizedException('OTP không hợp lệ hoặc đã hết hạn.');
    }

    const patients = await this.findPatientsByPhone(phoneNormalized);
    const existingUser = await this.prisma.user.findUnique({ where: { phoneNormalized } });
    const requiresPasswordSetup = !existingUser?.passwordHash && !newPassword;
    const user = await this.findOrCreatePatientUser(phoneNormalized, newPassword);
    await this.prisma.$transaction([
      ...(requiresPasswordSetup ? [] : [this.prisma.otpVerification.update({ where: { id: record.id }, data: { usedAt: new Date() } })]),
      ...patients.map((patient) => this.prisma.patientAccess.upsert({
        where: { userId_patientId: { userId: user.id, patientId: patient.id } },
        update: { status: 'ACTIVE', revokedAt: null, canBookVisit: true },
        create: {
          userId: user.id,
          patientId: patient.id,
          relationship: 'SELF',
          status: 'ACTIVE',
          canBookVisit: true,
          verifiedAt: new Date(),
        },
      })),
    ]);

    return this.buildLoginResponse(user.id, phoneNormalized, patients);
  }

  async passwordLogin(phoneInput: string, password: string) {
    const phoneNormalized = this.normalizeVietnamPhone(phoneInput);
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
    return this.buildLoginResponse(user.id, phoneNormalized, patients);
  }

  private async issueOtp(
    phoneInput: string,
    message: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<OtpResponse> {
    const phoneNormalized = this.normalizeVietnamPhone(phoneInput);
    const key = `patient-otp-request:${ipAddress || 'unknown'}:${phoneNormalized}`;
    this.rateLimiter.assertAllowed(key, 5, 10 * 60 * 1000);

    const now = new Date();
    const latestOtp = await this.prisma.otpVerification.findFirst({
      where: {
        phoneNormalized,
        purpose: 'PATIENT_LOGIN',
        usedAt: null,
      },
      orderBy: { createdAt: 'desc' },
      select: { sentAt: true, expiresAt: true },
    });

    const cooldown = this.getCooldownMetadata(latestOtp?.sentAt ?? null, latestOtp?.expiresAt ?? null, now);
    if (cooldown.resendAfterSeconds > 0) {
      return { success: true, message, ...cooldown };
    }

    const patients = await this.findPatientsByPhone(phoneNormalized);
    const existingUser = await this.prisma.user.findUnique({
      where: { phoneNormalized },
      select: { id: true, status: true },
    });

    // Public response is intentionally generic to avoid phone-number enumeration.
    if (!patients.length && !existingUser) {
      this.rateLimiter.recordFailure(key, 10 * 60 * 1000);
      return this.buildOtpMetadataResponse(message, now);
    }

    await this.prisma.otpVerification.updateMany({
      where: {
        phoneNormalized,
        purpose: 'PATIENT_LOGIN',
        usedAt: null,
      },
      data: { usedAt: now },
    });

    const otp = this.generateOtp();
    const expiresAt = new Date(now.getTime() + OTP_TTL_MS);
    await this.prisma.otpVerification.create({
      data: {
        phone: phoneInput.trim(),
        phoneNormalized,
        otpHash: this.hashOtp(phoneNormalized, otp),
        purpose: 'PATIENT_LOGIN',
        expiresAt,
        ipAddress,
        userAgent: userAgent?.slice(0, 255),
        requestId: crypto.randomUUID(),
        sentAt: now,
      },
    });

    await this.smsService.sendOtp(phoneNormalized, otp);
    this.rateLimiter.reset(key);
    return this.buildOtpMetadataResponse(message, now, expiresAt);
  }

  private buildOtpMetadataResponse(message: string, sentAt: Date, expiresAt = new Date(sentAt.getTime() + OTP_TTL_MS)): OtpResponse {
    return {
      success: true,
      message,
      resendAfterSeconds: Math.ceil(OTP_RESEND_COOLDOWN_MS / 1000),
      canResendAt: new Date(sentAt.getTime() + OTP_RESEND_COOLDOWN_MS).toISOString(),
      otpExpiresAt: expiresAt.toISOString(),
    };
  }

  private getCooldownMetadata(sentAt: Date | null, expiresAt: Date | null, now: Date): Omit<OtpResponse, 'success' | 'message'> {
    if (!sentAt) {
      return {
        resendAfterSeconds: 0,
        canResendAt: now.toISOString(),
        otpExpiresAt: new Date(now.getTime() + OTP_TTL_MS).toISOString(),
      };
    }

    const canResendAt = new Date(sentAt.getTime() + OTP_RESEND_COOLDOWN_MS);
    const resendAfterSeconds = Math.max(0, Math.ceil((canResendAt.getTime() - now.getTime()) / 1000));
    return {
      resendAfterSeconds,
      canResendAt: canResendAt.toISOString(),
      otpExpiresAt: (expiresAt ?? new Date(sentAt.getTime() + OTP_TTL_MS)).toISOString(),
    };
  }

  private async findOrCreatePatientUser(phoneNormalized: string, newPassword?: string) {
    const existing = await this.prisma.user.findUnique({ where: { phoneNormalized } });
    if (existing) {
      if (!existing.passwordHash && newPassword) {
        return this.prisma.user.update({
          where: { id: existing.id },
          data: { passwordHash: hashPassword(newPassword), firstLogin: false, status: 'ACTIVE' },
        });
      }
      return existing;
    }

    return this.prisma.user.create({
      data: {
        username: `patient_${phoneNormalized}`,
        email: null,
        phone: this.toLocalPhone(phoneNormalized),
        phoneNormalized,
        passwordHash: newPassword ? hashPassword(newPassword) : null,
        role: 'PATIENT',
        status: 'ACTIVE',
        firstLogin: !newPassword,
        registrationStep: newPassword ? 2 : 1,
      },
    });
  }

  private async buildLoginResponse(userId: string, phoneNormalized: string, patients: PatientLoginRecord[]) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: { patientAccesses: { where: { status: 'ACTIVE' }, include: { patient: true } } },
    });
    const linkedPatients = user.patientAccesses.length
      ? user.patientAccesses.map((access) => access.patient)
      : patients;

    const accessToken = this.jwtService.sign({
      sub: user.id,
      username: user.username,
      role: 'PATIENT',
      verified: true,
      firstLogin: user.firstLogin,
      tokenVersion: user.tokenVersion,
      patientIds: linkedPatients.map((patient) => patient.id),
    });

    return {
      accessToken,
      requirePasswordSetup: !user.passwordHash,
      user: {
        id: user.id,
        phone: user.phone,
        phoneNormalized,
      },
      patients: linkedPatients.map((patient) => ({
        id: patient.id,
        patientCode: patient.patientCode,
        fullName: patient.fullName,
        phone: patient.phone,
      })),
    };
  }

  private async findPatientsByPhone(phoneNormalized: string): Promise<PatientLoginRecord[]> {
    const localPhone = this.toLocalPhone(phoneNormalized);
    return this.prisma.patient.findMany({
      where: {
        OR: [
          { phone: localPhone },
          { phone: phoneNormalized },
          { phone: `+${phoneNormalized}` },
        ],
      },
      select: { id: true, patientCode: true, fullName: true, phone: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  private normalizeVietnamPhone(phone: string): string {
    const compact = phone.trim().replace(/[\s.-]/g, '').replace(/^\+/, '');
    if (/^0(3|5|7|8|9)\d{8}$/.test(compact)) return `84${compact.slice(1)}`;
    if (/^84(3|5|7|8|9)\d{8}$/.test(compact)) return compact;
    throw new BadRequestException('Số điện thoại không đúng định dạng Việt Nam.');
  }

  private toLocalPhone(phoneNormalized: string): string {
    return phoneNormalized.startsWith('84') ? `0${phoneNormalized.slice(2)}` : phoneNormalized;
  }

  private generateOtp(): string {
    const max = 10 ** OTP_LENGTH;
    return String(crypto.randomInt(0, max)).padStart(OTP_LENGTH, '0');
  }

  private hashOtp(phoneNormalized: string, otp: string): string {
    const secret = process.env.OTP_SECRET || process.env.JWT_SECRET || 'dev-otp-secret';
    return crypto.createHmac('sha256', secret).update(`${phoneNormalized}:${otp}`).digest('hex');
  }
}
