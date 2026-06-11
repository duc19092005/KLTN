import React from 'react';
import { FlaskConical } from 'lucide-react';
import { usePreferences } from '../../providers/PreferencesProvider';

/**
 * DemoModeToggle — prominently toggles demo mode to bypass date/time constraints.
 * When ON: shines amber/orange with a glowing pulse animation and "DEMO" label.
 * When OFF: subtle grey badge.
 */
export default function DemoModeToggle() {
  const { prefs, setPreference, accentHex } = usePreferences();
  const demoMode = prefs.demoMode || false;

  return (
    <button
      id="demo-mode-toggle"
      type="button"
      role="switch"
      aria-checked={demoMode}
      onClick={() => setPreference('demoMode', !demoMode)}
      title={demoMode ? 'Tắt chế độ trình diễn' : 'Bật chế độ trình diễn (bỏ qua kiểm tra ngày giờ)'}
      className={`relative flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-black uppercase tracking-wider transition-colors duration-300 outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-amber-400 select-none shrink-0 ${
        demoMode
          ? 'bg-amber-500 text-white shadow-sm animate-pulse'
          : 'bg-slate-100 text-slate-400 hover:text-slate-600 border border-slate-200'
      }`}
      style={demoMode ? { animationDuration: '2s', backgroundColor: '#f59e0b' } : undefined}
    >
      <FlaskConical className={`w-3.5 h-3.5 ${demoMode ? 'animate-bounce' : ''}`} strokeWidth={2.5} />
      <span>{demoMode ? 'DEMO' : 'DEMO'}</span>
      {/* Glow ring when ON */}
      {demoMode && (
        <span className="absolute inset-0 rounded-full bg-amber-400 opacity-40 blur-sm -z-10" />
      )}
    </button>
  );
}
