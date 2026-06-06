import React from 'react';
import { useScreenLock } from '../../features/auth';

/**
 * Header "Sleep" button — manually locks the screen on demand (e.g. the user steps away from a
 * shared workstation). Mirrors the iPhone side-button: one tap drops the lock overlay immediately.
 * Unlocking requires a face scan. Locking also clears any active step-up privilege session.
 */
export default function SleepButton() {
  const { lockNow } = useScreenLock();

  return (
    <button
      id="dashboard-sleep-button"
      type="button"
      onClick={lockNow}
      className="p-2 rounded-xl bg-white hover:bg-slate-900 text-slate-400 hover:text-white transition-colors border border-slate-200 hover:border-slate-900 outline-none"
      title="Khóa màn hình (Ngủ)"
      aria-label="Khóa màn hình"
    >
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
      </svg>
    </button>
  );
}
