import React, { useEffect, useState } from 'react';
import FaceCapture from './FaceCapture';
import { authService } from '../apis/authService';
import { stepUpSession } from '../../../shared/stepup/sessionStore';
import LoadingIndicator from '../../../shared/components/LoadingIndicator';

/**
 * ScreenLockOverlay — a full-screen "sleep" lock for shared clinical workstations.
 *
 * Rendered on top of the entire app (the app stays mounted underneath, so any half-typed form is
 * preserved — unlocking returns the user exactly where they left off, like an iPhone lock screen).
 *
 * Unlocking requires a single face scan. A successful scan does double duty: it proves the
 * operator's identity to unlock AND opens a step-up privilege session, so the user can immediately
 * resume sensitive writes without scanning a second time.
 *
 * There is intentionally no "cancel" — the only ways out are a successful scan or logging out.
 */
export default function ScreenLockOverlay({ user, onUnlock, onLogout }) {
  const [phase, setPhase] = useState('idle'); // idle | scan | submitting | error
  const [error, setError] = useState('');
  const [clock, setClock] = useState(() => new Date());

  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const handleCapture = async (embedding) => {
    setPhase('submitting');
    setError('');
    try {
      const challengeRes = await authService.faceChallenge();
      const challenge = challengeRes.data?.challenge;
      if (!challenge) throw new Error('Không lấy được mã thử thách (challenge).');

      const res = await authService.openStepUpSession(embedding, challenge);
      if (!res.data?.session) throw new Error('Không mở được phiên xác thực.');

      // One scan = unlock + privilege session, so the user can keep working without re-scanning.
      stepUpSession.setSession(res.data.session, {
        idleExpiresAt: res.data.idleExpiresAt,
        absoluteExpiresAt: res.data.absoluteExpiresAt,
      });
      onUnlock();
    } catch (err) {
      setError(err?.response?.data?.message || err.message || 'Mở khóa thất bại. Vui lòng thử lại.');
      setPhase('error');
    }
  };

  const timeLabel = clock.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  const dateLabel = clock.toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });
  const displayName = user?.username || 'Người dùng';
  const initials = (displayName.split(/[\s@._-]+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('')) || 'U';

  return (
    <div className="fixed inset-0 z-[80] flex flex-col items-center justify-center overflow-hidden bg-slate-950 text-white">
      {/* Ambient gradient backdrop */}
      <div className="pointer-events-none absolute inset-0 opacity-70">
        <div className="absolute -top-1/4 left-1/4 h-[60vh] w-[60vh] rounded-full bg-blue-600/30 blur-[120px]" />
        <div className="absolute bottom-0 right-1/4 h-[50vh] w-[50vh] rounded-full bg-cyan-500/20 blur-[120px]" />
      </div>

      <div className="relative flex w-full max-w-md flex-col items-center px-6">
        {/* Clock */}
        <div className="mb-8 text-center">
          <p className="text-6xl font-black tracking-tight tabular-nums">{timeLabel}</p>
          <p className="mt-2 text-sm font-medium capitalize text-slate-400">{dateLabel}</p>
        </div>

        {phase === 'idle' && (
          <>
            <div className="flex flex-col items-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 text-xl font-black backdrop-blur-sm ring-1 ring-white/15">
                {initials}
              </div>
              <p className="mt-3 text-lg font-bold">{displayName}</p>
              <div className="mt-1 inline-flex items-center gap-1.5 text-xs font-semibold text-amber-300">
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
                Màn hình đã khóa
              </div>
            </div>

            <button
              onClick={() => setPhase('scan')}
              className="mt-8 w-full rounded-2xl bg-white px-5 py-3.5 text-sm font-black text-slate-900 shadow-xl transition hover:bg-slate-100"
            >
              Quét khuôn mặt để mở khóa
            </button>
            <button
              onClick={onLogout}
              className="mt-3 text-xs font-bold text-slate-400 hover:text-white"
            >
              Đăng xuất khỏi tài khoản
            </button>
          </>
        )}

        {(phase === 'scan' || phase === 'submitting' || phase === 'error') && (
          <div className="w-full rounded-3xl bg-white/5 p-5 ring-1 ring-white/10 backdrop-blur-md">
            {error && (
              <div className="mb-4 rounded-2xl border border-red-400/30 bg-red-500/15 p-3 text-sm font-bold text-red-200">{error}</div>
            )}
            {phase === 'submitting' ? (
              <div className="flex flex-col items-center justify-center py-10">
                <LoadingIndicator size="lg" tone="blue" />
                <p className="mt-4 text-sm font-bold text-slate-200">Đang xác thực và mở khóa…</p>
              </div>
            ) : (
              <FaceCapture
                captureMode="verify"
                onCapture={handleCapture}
                onError={(msg) => { setError(msg); setPhase('error'); }}
                label="Đang đối chiếu khuôn mặt để mở khóa..."
              />
            )}
            {phase === 'error' && (
              <button
                onClick={() => { setError(''); setPhase('scan'); }}
                className="mt-4 w-full rounded-2xl bg-blue-600 px-5 py-3 text-sm font-black text-white hover:bg-blue-700"
              >
                Thử lại
              </button>
            )}
            <button
              onClick={onLogout}
              className="mt-3 w-full text-center text-xs font-bold text-slate-400 hover:text-white"
            >
              Đăng xuất khỏi tài khoản
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
