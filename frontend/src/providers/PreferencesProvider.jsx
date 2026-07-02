import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from './AuthProvider';

/**
 * PreferencesProvider — per-user UI personalization that lives entirely client-side.
 *
 * These are "comfort" settings (look & feel, alert sounds, privacy nudges) that don't need to be
 * authoritative on the server, so we persist them in localStorage keyed by user id. That keeps the
 * feature self-contained (no migration / API surface) while still being per-account on a shared
 * workstation: signing in as a different operator loads their own prefs.
 *
 * Account security settings such as passwords stay on the backend — this only
 * covers preferences where the worst case of tampering is a different theme color.
 */
const PreferencesContext = createContext(null);

export function usePreferences() {
  const ctx = useContext(PreferencesContext);
  if (!ctx) throw new Error('usePreferences must be used within PreferencesProvider');
  return ctx;
}

// Curated accent palette — harmonized with the "Hospital OS" design system. Each maps to a hex
// exposed as the `--app-accent` CSS variable so personalized surfaces can opt in.
export const ACCENTS = {
  cyan: { label: 'Xanh ngọc', hex: '#0891b2' },
  teal: { label: 'Xanh teal', hex: '#0f766e' },
  sky: { label: 'Xanh trời', hex: '#0284c7' },
  slate: { label: 'Xám y tế', hex: '#475569' },
};

export const DEFAULT_PREFERENCES = {
  timeFormat: '24h', // '24h' | '12h'
  accent: 'cyan', // key of ACCENTS
  reduceMotion: false, // calm UI: kill non-essential animations
  compactTables: false, // denser tables for data-heavy roles
  soundAlerts: true, // audible cue for new queue / results
  showGreeting: true, // friendly greeting banner on dashboards
  clockFace: 'digital', // 'digital' | 'analog' | 'minimal'
};

const STORAGE_PREFIX = 'kltn.prefs.';

function storageKey(user) {
  return `${STORAGE_PREFIX}${user?.id || user?.username || 'anon'}`;
}

function readStored(user) {
  try {
    const raw = localStorage.getItem(storageKey(user));
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function PreferencesProvider({ children }) {
  const { user } = useAuth();
  const [prefs, setPrefs] = useState(DEFAULT_PREFERENCES);

  // Load the signed-in user's stored prefs whenever the identity changes.
  useEffect(() => {
    setPrefs({ ...DEFAULT_PREFERENCES, ...readStored(user) });
  }, [user?.id, user?.username]);

  // Persist + reflect into the DOM so global concerns (motion, accent) apply everywhere.
  useEffect(() => {
    try {
      localStorage.setItem(storageKey(user), JSON.stringify(prefs));
    } catch {
      /* storage full / disabled — prefs simply won't persist across reloads */
    }
    const root = document.documentElement;
    root.dataset.reduceMotion = prefs.reduceMotion ? 'true' : 'false';
    root.dataset.density = prefs.compactTables ? 'compact' : 'comfortable';
    root.style.setProperty('--app-accent', (ACCENTS[prefs.accent] || ACCENTS.cyan).hex);
  }, [prefs, user?.id, user?.username]);

  const setPreference = useCallback((key, value) => {
    setPrefs((prev) => ({ ...prev, [key]: value }));
  }, []);

  const resetPreferences = useCallback(() => setPrefs(DEFAULT_PREFERENCES), []);

  // Format a Date according to the user's clock preference. Single source of truth so every
  // surface (lock screen, badges, tables) renders time consistently.
  const formatTime = useCallback(
    (date, opts = {}) =>
      new Date(date).toLocaleTimeString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: prefs.timeFormat === '12h',
        ...opts,
      }),
    [prefs.timeFormat],
  );

  const accentHex = (ACCENTS[prefs.accent] || ACCENTS.cyan).hex;

  const value = useMemo(
    () => ({ prefs, setPreference, resetPreferences, formatTime, accentHex }),
    [prefs, setPreference, resetPreferences, formatTime, accentHex],
  );

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}
