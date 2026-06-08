import { BadRequestException } from '@nestjs/common';
import { ShiftCode } from '@prisma/client';

export const PARACLINICAL_SHIFT_WINDOWS: Record<ShiftCode, { label: string; startHour: number; endHour: number }> = {
  A: { label: 'Ca A', startHour: 7, endHour: 12 },
  B: { label: 'Ca B', startHour: 13, endHour: 17 },
};

export type ResolvedParaclinicalShiftWindow = {
  workDate: Date;
  shiftCode: ShiftCode;
  startTime: Date;
  endTime: Date;
  label: string;
};

export function resolveParaclinicalShiftWindow(workDateInput: string | Date, shiftCode: ShiftCode): ResolvedParaclinicalShiftWindow {
  const window = PARACLINICAL_SHIFT_WINDOWS[shiftCode];
  if (!window) {
    throw new BadRequestException('Ca trực không hợp lệ. Chỉ hỗ trợ Ca A hoặc Ca B.');
  }

  const rawDate = typeof workDateInput === 'string' ? new Date(workDateInput) : new Date(workDateInput);
  if (Number.isNaN(rawDate.getTime())) {
    throw new BadRequestException('Ngày trực không hợp lệ.');
  }

  const workDate = new Date(rawDate);
  workDate.setHours(0, 0, 0, 0);

  const startTime = new Date(workDate);
  startTime.setHours(window.startHour, 0, 0, 0);

  const endTime = new Date(workDate);
  endTime.setHours(window.endHour, 0, 0, 0);

  return {
    workDate,
    shiftCode,
    startTime,
    endTime,
    label: window.label,
  };
}

export function formatParaclinicalShiftLabel(shiftCode: ShiftCode): string {
  const window = PARACLINICAL_SHIFT_WINDOWS[shiftCode];
  return window ? `${window.label} (${String(window.startHour).padStart(2, '0')}:00 - ${String(window.endHour).padStart(2, '0')}:00)` : shiftCode;
}
