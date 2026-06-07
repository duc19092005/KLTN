import React, { useEffect, useState } from 'react';
import { Lock, ScanFace, ShieldCheck } from 'lucide-react';
import FaceCapture from './FaceCapture';
import { authService } from '../apis/authService';
import { stepUpSession } from '../../../shared/stepup/sessionStore';
import { usePreferences } from '../../../providers/PreferencesProvider';
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
 *
 * Light theme: matches the rest of the "Hospital OS" surfaces so the lock screen doesn't feel like
 * a different app. A ScanFace icon + short description tells the operator exactly how to get back in.
 */
export default function ScreenLockOverlay({ user, onUnlock, onLogout }) {
  const { formatTime } = usePreferences();
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

  const timeLabel = formatTime(clock);
  const dateLabel = clock.toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });
  const displayName = user?.username || 'Người dùng';
  const initials = (displayName.split(/[\s@._-]+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('')) || 'U';

  return (
    <div className="fixed inset-0 z-[80] flex flex-col items-center justify-center overflow-hidden bg-[#F4F7FA] text-slate-800">
      {/* Soft ambient backdrop (light) */}
      <div className="pointer-events-none absolute inset-0 opacity-80">
        <div className="absolute -top-1/4 left-1/4 h-[60vh] w-[60vh] rounded-full bg-blue-200/40 blur-[120px]" />
        <div className="absolute bottom-0 right-1/4 h-[50vh] w-[50vh] rounded-full bg-cyan-200/40 blur-[120px]" />
      </div>

      <div className="relative flex w-full max-w-md flex-col items-center px-6">
        {/* Clock */}
        <div className="mb-8 text-center">
          <p className="text-6xl font-black tracking-tight tabular-nums text-slate-900">{timeLabel}</p>
          <p className="mt-2 text-sm font-medium capitalize text-slate-500">{dateLabel}</p>
        </div>

        {phase === 'idle' && (
          <>
            <div className="flex flex-col items-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-xl font-black text-blue-600 ring-1 ring-blue-100 shadow-sm">
                {initials}
              </div>
              <p className="mt-3 text-lg font-bold text-slate-900">{displayName}</p>
              <div className="mt-1 inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700">
                <Lock className="h-3.5 w-3.5" strokeWidth={2.5} />
                Màn hình đã khóa
              </div>
            </div>

            {/* Explanatory description with a distinct ScanFace icon so the user knows what to do */}
            <div className="mt-6 flex w-full items-start gap-3 rounded-2xl border border-blue-100 bg-blue-50/60 p-4">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm">
                <ScanFace className="h-5 w-5" strokeWidth={2} />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-bold text-slate-800">Mở khóa bằng khuôn mặt</p>
                <p className="mt-0.5 text-[13px] leading-snug text-slate-500">
                  Vì đây là máy trạm dùng chung, màn hình tự khóa khi rời đi. Quét khuôn mặt để xác minh chính bạn và tiếp tục công việc đang dở.
                </p>
              </div>
            </div>

            <button
              onClick={() => setPhase('scan')}
              className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 py-3.5 text-sm font-black text-white shadow-lg shadow-blue-100 transition hover:bg-blue-700"
            >
              <ScanFace className="h-4 w-4" strokeWidth={2.5} />
              Quét khuôn mặt để mở khóa
            </button>
            <button
              onClick={onLogout}
              className="mt-3 text-xs font-bold text-slate-400 hover:text-slate-700"
            >
              Đăng xuất khỏi tài khoản
            </button>
          </>
        )}

        {(phase === 'scan' || phase === 'submitting' || phase === 'error') && (
          <div className="w-full rounded-3xl border border-slate-200 bg-white p-5 shadow-xl shadow-slate-200/50">
            {/* Heading with ScanFace so the scan step is clearly labeled */}
            <div className="mb-4 flex items-center gap-2.5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm">
                <ScanFace className="h-5 w-5" strokeWidth={2} />
              </span>
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-blue-600">Mở khóa màn hình</p>
                <p className="text-sm font-bold text-slate-800">Quét khuôn mặt để xác minh</p>
              </div>
            </div>

            {error && (
              <div className="mb-4 rounded-2xl border border-red-100 bg-red-50 p-3 text-sm font-bold text-red-700">{error}</div>
            )}
            {phase === 'submitting' ? (
              <div className="flex flex-col items-center justify-center py-10">
                <LoadingIndicator size="lg" tone="blue" />
                <p className="mt-4 text-sm font-bold text-slate-700">Đang xác thực và mở khóa…</p>
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
              className="mt-3 w-full text-center text-xs font-bold text-slate-400 hover:text-slate-700"
            >
              Đăng xuất khỏi tài khoản
            </button>
          </div>
        )}

        {/* Reassurance footer */}
        <div className="mt-8 inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-400">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" strokeWidth={2.25} />
          Phiên làm việc của bạn được giữ an toàn trong khi khóa
        </div>
      </div>
    </div>
  );
}
