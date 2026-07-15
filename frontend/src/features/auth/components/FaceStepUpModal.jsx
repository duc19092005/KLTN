import React, { useState } from 'react';
import FaceCapture from './FaceCapture';
import { authService } from '../apis/authService';
import LoadingIndicator from '../../../shared/components/LoadingIndicator';

/**
 * FaceStepUpModal — biometric re-authentication gate for a highly sensitive action.
 *
 * This is step-up auth: the user is already logged in, but irreversible / money-touching actions
 * (deleting a doctor, committing a blockchain anchor) demand a fresh face scan at the exact moment
 * of the action so a hijacked or unattended session cannot trigger them.
 *
 * Flow:
 *   1. POST /auth/face-challenge -> single-use nonce
 *   2. FaceCapture runs liveness + extracts a 128D descriptor
 *   3. POST /auth/face-stepup { embedding, challenge, action, resourceId } -> single-use ticket
 *   4. onSuccess(ticket) — caller replays it via the `x-stepup-ticket` header on the real request
 *
 * Props:
 *   action      string  must match backend @RequireFaceStepUp(action)
 *   resourceId  string? optional target id; binds the ticket to one record
 *   title       string? heading text
 *   description string? explanatory copy
 *   onSuccess   (ticket: string) => void
 *   onClose     () => void
 */
export default function FaceStepUpModal({ action, resourceId, title, description, onSuccess, onClose }) {
  const [phase, setPhase] = useState('scan'); // scan | submitting | error
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0); // bump to force a fresh FaceCapture mount on retry

  const handleCapture = async (embedding) => {
    setPhase('submitting');
    setError('');
    try {
      const challengeRes = await authService.faceChallenge();
      const challenge = challengeRes.data?.challenge;
      if (!challenge) throw new Error('Không lấy được mã thử thách (challenge).');

      const res = await authService.faceStepUp(embedding, challenge, action, resourceId);
      const ticket = res.data?.ticket;
      if (!ticket) throw new Error('Máy chủ không trả về vé xác thực.');
      onSuccess?.(ticket);
    } catch (err) {
      setError(err?.response?.data?.message || err.message || 'Xác thực khuôn mặt thất bại.');
      setPhase('error');
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
      <div className="flex max-h-[94vh] w-full max-w-md flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="shrink-0 border-b border-slate-100 p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-cyan-600">Xác thực bảo mật</p>
              <h3 className="mt-1 text-xl font-black text-slate-950">{title || 'Quét khuôn mặt để xác nhận'}</h3>
              <p className="mt-1 text-sm text-slate-500">
                {description || 'Thao tác này rất nhạy cảm và không thể hoàn tác. Vui lòng quét khuôn mặt để xác nhận chính bạn đang thực hiện.'}
              </p>
            </div>
            <button onClick={onClose} className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-black text-slate-600 hover:bg-slate-50">Hủy</button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto bg-slate-50/60 p-5">
          {error && (
            <div className="mb-4 rounded-2xl border border-rose-100 bg-rose-50 p-4 text-sm font-bold text-rose-700">{error}</div>
          )}

          {phase === 'submitting' ? (
            <div className="flex flex-col items-center justify-center py-10">
              <LoadingIndicator size="lg" tone="cyan" />
              <p className="mt-4 text-sm font-bold text-slate-700">Đang xác thực và cấp vé bảo mật…</p>
            </div>
          ) : (
            <FaceCapture
              key={attempt}
              captureMode="verify"
              onCapture={handleCapture}
              onError={(msg) => { setError(msg); setPhase('error'); }}
              label="Đang đối chiếu khuôn mặt cho thao tác nhạy cảm..."
            />
          )}

          {phase === 'error' && (
            <button
              onClick={() => { setError(''); setAttempt((n) => n + 1); setPhase('scan'); }}
              className="mt-4 w-full rounded-2xl bg-cyan-600 px-5 py-3 text-sm font-black text-white shadow-sm hover:bg-cyan-700"
            >
              Thử lại
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
