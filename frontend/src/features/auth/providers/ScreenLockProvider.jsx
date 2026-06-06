import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useAuth } from '../../../providers/AuthProvider';
import { stepUpSession } from '../../../shared/stepup/sessionStore';
import ScreenLockOverlay from '../components/ScreenLockOverlay';

/**
 * ScreenLockProvider — the "Auto-Lock" layer for shared clinical workstations.
 *
 * Locks the whole UI behind a face-scan overlay when:
 *   - the user is idle for `autoLockMinutes` (their own preference, server-clamped to 1..15), or
 *   - the user explicitly hits "Sleep" (exposed via useScreenLock().lockNow()).
 *
 * The app stays mounted underneath, so in-progress work is preserved across a lock. Locking also
 * clears any step-up privilege session, so a walk-away can never leave write access open.
 *
 * Only active for an authenticated, fully-verified user; login/enrollment screens are never locked.
 */
const ScreenLockContext = createContext(null);

export function useScreenLock() {
  const ctx = useContext(ScreenLockContext);
  if (!ctx) throw new Error('useScreenLock must be used within ScreenLockProvider');
  return ctx;
}

const ACTIVITY_EVENTS = ['mousedown', 'keydown', 'touchstart', 'scroll'];

export default function ScreenLockProvider({ children }) {
  const { user, token, logout } = useAuth();
  const [locked, setLocked] = useState(false);
  const lastActivityRef = useRef(Date.now());

  // Lock is only meaningful for an authenticated, past-first-login user.
  const eligible = Boolean(token && user && !user.firstLogin);
  const autoLockMs = Math.max(1, Number(user?.autoLockMinutes) || 5) * 60 * 1000;

  const lockNow = useCallback(() => {
    stepUpSession.clear(); // never leave write access open behind a lock
    setLocked(true);
  }, []);

  const unlock = useCallback(() => {
    lastActivityRef.current = Date.now();
    setLocked(false);
  }, []);

  // Idle watchdog: poll every second; if no activity within the window, lock.
  useEffect(() => {
    if (!eligible || locked) return undefined;

    const markActivity = () => { lastActivityRef.current = Date.now(); };
    ACTIVITY_EVENTS.forEach((evt) => window.addEventListener(evt, markActivity, { passive: true }));

    const interval = setInterval(() => {
      if (Date.now() - lastActivityRef.current >= autoLockMs) lockNow();
    }, 1000);

    return () => {
      ACTIVITY_EVENTS.forEach((evt) => window.removeEventListener(evt, markActivity));
      clearInterval(interval);
    };
  }, [eligible, locked, autoLockMs, lockNow]);

  // If the user logs out while locked, drop the overlay.
  useEffect(() => {
    if (!eligible && locked) setLocked(false);
  }, [eligible, locked]);

  return (
    <ScreenLockContext.Provider value={{ locked, lockNow }}>
      {children}
      {locked && eligible && (
        <ScreenLockOverlay user={user} onUnlock={unlock} onLogout={logout} />
      )}
    </ScreenLockContext.Provider>
  );
}
