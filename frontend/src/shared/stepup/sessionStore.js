/**
 * Step-up SESSION store ("sudo mode") shared between the axios interceptor and the React provider.
 *
 * Why a module-level store: the axios error interceptor (plain JS) needs to (a) read the current
 * session token to retry a request, and (b) trigger a React face-scan modal when no valid session
 * exists. React state can't be read directly from the interceptor, so we keep the token here and
 * let the provider register a `requestHandler` that opens the modal.
 *
 * Persistence: the raw token is mirrored into sessionStorage so a page reload does NOT drop an
 * active privilege session (the backend keeps it alive until idle/absolute expiry). sessionStorage
 * is per-tab and cleared on tab close, which keeps exposure narrower than localStorage while still
 * surviving refresh. The server remains the source of truth and will reject a stale/revoked token,
 * at which point the interceptor transparently prompts a fresh scan. Parallel 403s share a single
 * scan (deduped via `inFlight`).
 */

const STORAGE_KEY = 'stepup_session';

function readPersisted() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.token || !parsed?.deadlines) return null;
    // Drop anything already past its absolute ceiling client-side (server still re-checks).
    const abs = new Date(parsed.deadlines.absoluteExpiresAt).getTime();
    if (Number.isFinite(abs) && abs <= Date.now()) return null;
    return parsed;
  } catch {
    return null;
  }
}

const persisted = readPersisted();
let sessionToken = persisted?.token ?? null;
let deadlines = persisted?.deadlines ?? null; // { idleExpiresAt, absoluteExpiresAt }
let requestHandler = null; // () => Promise<{ session, idleExpiresAt, absoluteExpiresAt }>
let inFlight = null; // Promise dedupe for concurrent 403s
const listeners = new Set();

function emit() {
  for (const fn of listeners) fn(deadlines);
}

function persist() {
  try {
    if (sessionToken && deadlines) {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ token: sessionToken, deadlines }));
    } else {
      sessionStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    /* storage unavailable (private mode / quota) — in-memory state still works for this tab */
  }
}

export const stepUpSession = {
  getToken: () => sessionToken,
  getDeadlines: () => deadlines,

  setSession(token, nextDeadlines) {
    sessionToken = token || null;
    deadlines = nextDeadlines || null;
    persist();
    emit();
  },

  clear() {
    sessionToken = null;
    deadlines = null;
    persist();
    emit();
  },

  /** Provider registers how to open the face-scan modal. */
  registerRequestHandler(fn) {
    requestHandler = fn;
    return () => { if (requestHandler === fn) requestHandler = null; };
  },

  /** Subscribe to deadline changes (for the countdown badge). Returns an unsubscribe fn. */
  subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },

  /**
   * Ensure a valid session exists, prompting a face scan if needed. Concurrent callers share one
   * scan. Resolves with the raw session token, or rejects if cancelled / no handler is mounted.
   */
  async ensure() {
    if (sessionToken) return sessionToken;
    if (inFlight) return inFlight;
    if (!requestHandler) {
      throw new Error('Chưa sẵn sàng xác thực khuôn mặt. Vui lòng thử lại.');
    }
    inFlight = (async () => {
      try {
        const result = await requestHandler();
        if (!result?.session) throw new Error('Không mở được phiên xác thực.');
        this.setSession(result.session, {
          idleExpiresAt: result.idleExpiresAt,
          absoluteExpiresAt: result.absoluteExpiresAt,
        });
        return result.session;
      } finally {
        inFlight = null;
      }
    })();
    return inFlight;
  },
};
