import {
  buildQrPayload,
  extractQrToken,
  generateDailySlots,
  generateQrToken,
  getQrExpiry,
  hashQrToken,
  startOfDay,
  toLocalPhone,
} from '../../../../../src/modules/patient-portal/domain/appointment-qr.util';

describe('Appointment QR and Slot Utils', () => {
  it('generates, hashes, builds, and extracts QR tokens correctly', () => {
    const rawToken = generateQrToken();
    expect(rawToken.length).toBeGreaterThanOrEqual(32);

    const hash1 = hashQrToken(rawToken);
    const hash2 = hashQrToken(rawToken);
    expect(hash1).toBe(hash2);
    expect(hash1).toMatch(/^[0-9a-f]{64}$/);

    const payload = buildQrPayload(rawToken);
    expect(payload).toContain('KLTN_APPOINTMENT_CHECKIN:');

    const extracted = extractQrToken(payload);
    expect(extracted).toBe(rawToken);
  });

  it('calculates QR expiry 2 hours after scheduled time', () => {
    const scheduledAt = new Date('2026-09-01T08:00:00.000Z');
    const expiry = getQrExpiry(scheduledAt);
    expect(expiry.getTime() - scheduledAt.getTime()).toBe(2 * 60 * 60 * 1000);
  });

  it('generates 14 daily slots from 8h to 16h', () => {
    const dayStart = startOfDay('2026-09-01');
    const slots = generateDailySlots(dayStart);
    expect(slots).toHaveLength(14);
    expect(slots[0].getHours()).toBe(8);
  });

  it('normalizes 84 country code phone to 0-prefixed local phone', () => {
    expect(toLocalPhone('84901234567')).toBe('0901234567');
    expect(toLocalPhone('0901234567')).toBe('0901234567');
    expect(toLocalPhone(null)).toBeNull();
  });
});