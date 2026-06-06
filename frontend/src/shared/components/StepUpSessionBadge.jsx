import React from 'react';
import { useStepUpSession } from '../../features/auth';

/**
 * Live "sudo mode" indicator for the dashboard header. Visible only while a step-up privilege
 * session is active: shows a shield + a mm:ss countdown to the session's next deadline, and a
 * lock button to end it early (vital on shared workstations). Pulses amber in the final minute.
 */
function formatMs(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function StepUpSessionBadge() {
  const { active, remainingMs, lock } = useStepUpSession();
  if (!active) return null;

  const urgent = remainingMs <= 60 * 1000;
  const tone = urgent
    ? 'border-amber-200 bg-amber-50 text-amber-700'
    : 'border-emerald-200 bg-emerald-50 text-emerald-700';

  return (
    <div
      id="stepup-session-badge"
      className={`hidden sm:flex items-center gap-2 rounded-xl border px-2.5 py-1.5 ${tone}`}
      title="Phiên xác thực khuôn mặt đang mở. Trong phiên, bạn không cần quét lại cho mỗi thao tác."
    >
      <svg className={`h-4 w-4 ${urgent ? 'animate-pulse' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
        <path d="m9 12 2 2 4-4" />
      </svg>
      <div className="leading-tight">
        <p className="text-[9px] font-black uppercase tracking-wider opacity-80">Phiên bảo mật</p>
        <p className="text-xs font-black tabular-nums">{formatMs(remainingMs)}</p>
      </div>
      <button
        type="button"
        onClick={lock}
        className="ml-1 rounded-lg border border-current/20 bg-white/60 px-2 py-1 text-[10px] font-black hover:bg-white transition-colors"
        title="Khóa phiên ngay"
      >
        Khóa
      </button>
    </div>
  );
}
