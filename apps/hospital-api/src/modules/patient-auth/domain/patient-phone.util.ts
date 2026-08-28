import * as crypto from 'crypto';
import { BadRequestException } from '@nestjs/common';

export const OTP_TTL_MS = 5 * 60 * 1000;
export const OTP_RESEND_COOLDOWN_MS = 60 * 1000;
export const OTP_LENGTH = 6;
export const PATIENT_LOGIN_MESSAGE = 'Nếu số điện thoại hợp lệ, OTP sẽ được gửi.';
export const PATIENT_RESEND_MESSAGE = 'Nếu số điện thoại hợp lệ, OTP mới sẽ được gửi khi hết thời gian chờ.';
export const INVALID_CREDENTIAL_MESSAGE = 'Số điện thoại hoặc thông tin xác thực không hợp lệ.';

export type OtpResponse = {
  success: true;
  message: string;
  resendAfterSeconds: number;
  canResendAt: string;
  otpExpiresAt: string;
};

export function normalizeVietnamPhone(phone: string): string {
  const compact = phone.trim().replace(/[\s.-]/g, '').replace(/^\+/, '');
  if (/^0(3|5|7|8|9)\d{8}$/.test(compact)) return `84${compact.slice(1)}`;
  if (/^84(3|5|7|8|9)\d{8}$/.test(compact)) return compact;
  throw new BadRequestException('Số điện thoại không đúng định dạng Việt Nam.');
}

export function toLocalPhone(phoneNormalized: string): string {
  return phoneNormalized.startsWith('84') ? `0${phoneNormalized.slice(2)}` : phoneNormalized;
}

export function generateOtp(): string {
  const max = 10 ** OTP_LENGTH;
  return String(crypto.randomInt(0, max)).padStart(OTP_LENGTH, '0');
}

export function hashOtp(phoneNormalized: string, otp: string): string {
  const secret = process.env.OTP_SECRET || process.env.JWT_SECRET || 'dev-otp-secret';
  return crypto.createHmac('sha256', secret).update(`${phoneNormalized}:${otp}`).digest('hex');
}

export function buildOtpMetadataResponse(message: string, sentAt: Date, expiresAt = new Date(sentAt.getTime() + OTP_TTL_MS)): OtpResponse {
  return {
    success: true,
    message,
    resendAfterSeconds: Math.ceil(OTP_RESEND_COOLDOWN_MS / 1000),
    canResendAt: new Date(sentAt.getTime() + OTP_RESEND_COOLDOWN_MS).toISOString(),
    otpExpiresAt: expiresAt.toISOString(),
  };
}

export function getCooldownMetadata(sentAt: Date | null, expiresAt: Date | null, now: Date): Omit<OtpResponse, 'success' | 'message'> {
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