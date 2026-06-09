import React from 'react';
import { Moon } from 'lucide-react';
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
      className="p-2 rounded-xl bg-white hover:bg-cyan-50 text-slate-400 hover:text-cyan-600 transition-colors border border-slate-200 hover:border-cyan-100 outline-none"
      title="Khóa màn hình (Ngủ)"
      aria-label="Khóa màn hình"
    >
      <Moon className="h-4 w-4" strokeWidth={2} />
    </button>
  );
}
