import * as crypto from 'crypto';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../../../infrastructure/prisma/prisma.service';
import { AuthRateLimiterService } from '../../../auth/services/auth-rate-limiter.service';
import { hashPassword } from '../../../auth/domain/credential.util';
import { EsmsService } from '../../sms/esms.service';
import {
  OTP_TTL_MS,
  PATIENT_LOGIN_MESSAGE,
  PATIENT_RESEND_MESSAGE,
  OtpResponse,
  buildOtpMetadataResponse,
  generateOtp,
  getCooldownMetadata,
  hashOtp,
  normalizeVietnamPhone,
  toLocalPhone,
} from '../../domain/patient-phone.util';

type PatientLoginRecord = {
  id: string;
  patientCode: string;
  fullName: string;
  phone: string | null;
};

@Injectable()
export class PatientOtpUseCase {
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
    const phoneNormalized = normalizeVietnamPhone(phoneInput);
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

    const expectedHash = hashOtp(phoneNormalized, otp);
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

  private async issueOtp(
    phoneInput: string,
    message: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<OtpResponse> {
    const phoneNormalized = normalizeVietnamPhone(phoneInput);
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

    const cooldown = getCooldownMetadata(latestOtp?.sentAt ?? null, latestOtp?.expiresAt ?? null, now);
    if (cooldown.resendAfterSeconds > 0) {
      return { success: true, message, ...cooldown };
    }

    const patients = await this.findPatientsByPhone(phoneNormalized);
    const existingUser = await this.prisma.user.findUnique({
      where: { phoneNormalized },
      select: { id: true, status: true },
    });

    if (!patients.length && !existingUser) {
      this.rateLimiter.recordFailure(key, 10 * 60 * 1000);
      return buildOtpMetadataResponse(message, now);
    }

    await this.prisma.otpVerification.updateMany({
      where: {
        phoneNormalized,
        purpose: 'PATIENT_LOGIN',
        usedAt: null,
      },
      data: { usedAt: now },
    });

    const otp = generateOtp();
    const expiresAt = new Date(now.getTime() + OTP_TTL_MS);
    await this.prisma.otpVerification.create({
      data: {
        phone: phoneInput.trim(),
        phoneNormalized,
        otpHash: hashOtp(phoneNormalized, otp),
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
    return buildOtpMetadataResponse(message, now, expiresAt);
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
        phone: toLocalPhone(phoneNormalized),
        phoneNormalized,
        passwordHash: newPassword ? hashPassword(newPassword) : null,
        role: 'PATIENT',
        status: 'ACTIVE',
        firstLogin: !newPassword,
        registrationStep: newPassword ? 2 : 1,
      },
    });
  }

  async buildLoginResponse(userId: string, phoneNormalized: string, patients: PatientLoginRecord[]) {
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

  async findPatientsByPhone(phoneNormalized: string): Promise<PatientLoginRecord[]> {
    const localPhone = toLocalPhone(phoneNormalized);
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
}