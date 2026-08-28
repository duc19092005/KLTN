import * as crypto from 'crypto';
import { BadRequestException } from '@nestjs/common';

export const QR_PREFIX = 'KLTN_APPOINTMENT_CHECKIN:';
export const SLOT_MINUTES = 30;
export const APPOINTMENT_QR_GRACE_HOURS = 2;
export const BOOKING_LOOKAHEAD_DAYS = 60;

export function buildQrPayload(rawToken: string): string {
  return `${QR_PREFIX}${rawToken}`;
}

export function extractQrToken(qrPayload: string): string {
  const rawToken = qrPayload.startsWith(QR_PREFIX) ? qrPayload.slice(QR_PREFIX.length) : qrPayload;
  if (!rawToken || rawToken.length < 32) throw new BadRequestException('Mã QR không hợp lệ.');
  return rawToken;
}

export function generateQrToken(): string {
  return crypto.randomBytes(32).toString('base64url');
}

export function hashQrToken(rawToken: string): string {
  const secret = process.env.APPOINTMENT_QR_SECRET || process.env.JWT_SECRET || 'dev-appointment-qr-secret';
  return crypto.createHmac('sha256', secret).update(rawToken).digest('hex');
}

export function getQrExpiry(scheduledAt: Date): Date {
  return new Date(scheduledAt.getTime() + APPOINTMENT_QR_GRACE_HOURS * 60 * 60 * 1000);
}

export function generateDailySlots(dayStart: Date): Date[] {
  const slots: Date[] = [];
  for (const hour of [8, 9, 10, 13, 14, 15, 16]) {
    for (const minute of [0, SLOT_MINUTES]) {
      const slot = new Date(dayStart);
      slot.setHours(hour, minute, 0, 0);
      slots.push(slot);
    }
  }
  return slots;
}

export function startOfDay(dateInput: string): Date {
  const date = new Date(dateInput);
  if (Number.isNaN(date.getTime())) throw new BadRequestException('Ngày không hợp lệ.');
  date.setHours(0, 0, 0, 0);
  return date;
}

export function toLocalPhone(phoneNormalized: string | null): string | null {
  if (!phoneNormalized) return null;
  return phoneNormalized.startsWith('84') ? `0${phoneNormalized.slice(2)}` : phoneNormalized;
}