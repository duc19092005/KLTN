import React from 'react';
import { cn } from './cn';

const TONES = {
  success: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  warning: 'border-amber-200 bg-amber-50 text-amber-700',
  danger: 'border-rose-200 bg-rose-50 text-rose-700',
  info: 'border-cyan-200 bg-cyan-50 text-cyan-700',
  neutral: 'border-slate-200 bg-slate-50 text-slate-600',
};

export default function Badge({ tone = 'neutral', children, dot = false, className = '' }) {
  return (
    <span className={cn('ui-badge inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-black', TONES[tone] || TONES.neutral, className)}>
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}

export function toneForStatus(status) {
  const value = String(status || '').toUpperCase();
  if (['ACTIVE', 'APPROVED', 'COMPLETED', 'RESULT_READY', 'VERIFIED', 'SUCCESS'].includes(value)) return 'success';
  if (['PENDING', 'WAITING', 'ORDERED', 'WAITING_TEST_RESULT', 'WAITING_CONCLUSION', 'UNANCHORED', 'PENDING_ANCHOR'].includes(value)) return 'warning';
  if (['CANCELLED', 'REJECTED', 'INACTIVE', 'TAMPERED', 'FAILED', 'ERROR'].includes(value)) return 'danger';
  if (['IN_PROGRESS', 'PROCESSING', 'INFO'].includes(value)) return 'info';
  return 'neutral';
}
