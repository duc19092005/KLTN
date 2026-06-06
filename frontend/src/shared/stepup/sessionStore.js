/**
 * Step-up SESSION store ("sudo mode") shared between the axios interceptor and the React provider.
 *
 * Why a module-level store: the axios error interceptor (plain JS) needs to (a) read the current
 * session token to retry a request, and (b) trigger a React face-scan modal when no valid session
 * exists. React state can't be read directly from the interceptor, so we keep the token here and
 * let the provider register a `requestHandler` that opens the modal.
 *
 * Security: the raw token lives only in memory (never localStorage) to limit XSS exposure; it dies
 * on refresh, forcing a fresh scan. Parallel 403s share a single scan (deduped via `inFlight`).
 */

let sessionToken = null;
let deadlines = null; // { idleExpiresAt, absoluteExpiresAt }
let requestHandler = null; // () => Promise<{ session, idleExpiresAt, absoluteExpiresAt }>
let inFlight = null; // Promise dedupe for concurrent 403s
const listeners = new Set();

function emit() {
  for (const fn of listeners) fn(deadlines);
}

export const stepUpSession = {
  getToken: () => sessionToken,
  getDeadlines: () => deadlines,

  setSession(token, nextDeadlines) {
    sessionToken = token || null;
    deadlines = nextDeadlines || null;
    emit();
  },

  clear() {
    sessionToken = null;
    deadlines = null;
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
