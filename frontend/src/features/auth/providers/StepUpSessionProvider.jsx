import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { stepUpSession } from '../../../shared/stepup/sessionStore';
import { authService } from '../apis/authService';
import FaceStepUpModal from '../components/FaceStepUpModal';

/**
 * StepUpSessionProvider wires the "sudo mode" privilege session into the React tree:
 *
 *  - Registers a request handler so the axios interceptor can, on a 403 STEPUP_SESSION_REQUIRED,
 *    pop a single face-scan modal and resolve with a fresh session token (the failed request is
 *    then transparently retried — the user never loses what they were doing).
 *  - Tracks the active session's deadlines to drive a live countdown badge in the header.
 *  - Exposes lock() to end the session early (important on shared workstations).
 *
 * The raw token lives only in the in-memory sessionStore (never localStorage).
 */
const StepUpSessionContext = createContext(null);

export function useStepUpSession() {
  const ctx = useContext(StepUpSessionContext);
  if (!ctx) throw new Error('useStepUpSession must be used within StepUpSessionProvider');
  return ctx;
}

function computeRemaining(deadlines) {
  if (!deadlines) return 0;
  const idle = new Date(deadlines.idleExpiresAt).getTime();
  const abs = new Date(deadlines.absoluteExpiresAt).getTime();
  return Math.max(0, Math.min(idle, abs) - Date.now());
}

export default function StepUpSessionProvider({ children }) {
  const [deadlines, setDeadlines] = useState(stepUpSession.getDeadlines());
  const [remainingMs, setRemainingMs] = useState(computeRemaining(deadlines));
  const [modalOpen, setModalOpen] = useState(false);
  const resolverRef = useRef(null); // { resolve, reject } for the pending interceptor request

  // Keep local deadlines in sync with the shared store.
  useEffect(() => stepUpSession.subscribe(setDeadlines), []);

  // Register how the interceptor opens a scan: show the modal and hand back a promise that
  // resolves with the session payload once the scan succeeds (or rejects on cancel).
  useEffect(() => {
    return stepUpSession.registerRequestHandler(
      () =>
        new Promise((resolve, reject) => {
          resolverRef.current = { resolve, reject };
          setModalOpen(true);
        }),
    );
  }, []);

  // Tick the countdown every second; auto-clear the session when it lapses.
  useEffect(() => {
    if (!deadlines) {
      setRemainingMs(0);
      return undefined;
    }
    const tick = () => {
      const ms = computeRemaining(deadlines);
      setRemainingMs(ms);
      if (ms <= 0) stepUpSession.clear();
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [deadlines]);

  const handleSuccess = useCallback((sessionPayload) => {
    setModalOpen(false);
    stepUpSession.setSession(sessionPayload.session, {
      idleExpiresAt: sessionPayload.idleExpiresAt,
      absoluteExpiresAt: sessionPayload.absoluteExpiresAt,
    });
    resolverRef.current?.resolve(sessionPayload);
    resolverRef.current = null;
  }, []);

  const handleClose = useCallback(() => {
    setModalOpen(false);
    resolverRef.current?.reject(new Error('Đã hủy xác thực khuôn mặt.'));
    resolverRef.current = null;
  }, []);

  const lock = useCallback(async () => {
    stepUpSession.clear();
    try { await authService.revokeStepUpSession(); } catch { /* best-effort server revoke */ }
  }, []);

  const value = {
    active: remainingMs > 0,
    remainingMs,
    lock,
  };

  return (
    <StepUpSessionContext.Provider value={value}>
      {children}
      {modalOpen && (
        <FaceStepUpModal
          mode="session"
          title="Mở phiên xác thực"
          description="Quét khuôn mặt một lần để mở phiên thao tác bảo mật. Trong phiên, bạn có thể thực hiện nhiều thao tác mà không cần quét lại cho tới khi phiên hết hạn."
          onSuccess={handleSuccess}
          onClose={handleClose}
        />
      )}
    </StepUpSessionContext.Provider>
  );
}
