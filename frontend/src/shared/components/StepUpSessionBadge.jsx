import React from 'react';
import { ShieldCheck, ScanFace } from 'lucide-react';
import { useStepUpSession } from '../../features/auth';

/**
 * "Sudo mode" indicator + control for the dashboard header.
 *
 *  - While a step-up session is active: shows a shield + mm:ss countdown to the next deadline and a
 *    lock button to end it early (vital on shared workstations). Pulses amber in the final minute.
 *  - While no session is active: shows a subtle "open session" button so the user can proactively
 *    scan their face once up front, instead of only discovering the requirement when a sensitive
 *    action is blocked. Better UX than a dead-end warning.
 */
function formatMs(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function StepUpSessionBadge() {
  const { active, remainingMs, lock, open } = useStepUpSession();

  // No active session → offer a proactive "open privilege session" button.
  if (!active) {
    return (
      <button
        id="stepup-session-open"
        type="button"
        onClick={open}
        className="hidden sm:flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-slate-500 hover:border-cyan-200 hover:bg-cyan-50 hover:text-cyan-700 transition-colors"
        title="Mở phiên xác thực khuôn mặt để thực hiện các thao tác bảo mật mà không cần quét lại từng lần."
      >
        <ScanFace className="h-4 w-4" strokeWidth={2} />
        <div className="leading-tight text-left">
          <p className="text-[9px] font-black uppercase tracking-wider opacity-80">Phiên bảo mật</p>
          <p className="text-xs font-black">Mở phiên</p>
        </div>
      </button>
    );
  }

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
      <ShieldCheck className={`h-4 w-4 ${urgent ? 'animate-pulse' : ''}`} strokeWidth={2} />
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
