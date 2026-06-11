import axios from 'axios';
import { API_URL } from '../../utils/constants';
import { stepUpSession } from '../stepup/sessionStore';

const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
});

// Attach the current step-up session token (if any) to every request. Tier-B endpoints read it
// from the x-stepup-session header; other endpoints simply ignore it.
api.interceptors.request.use((config) => {
  const token = stepUpSession.getToken();
  if (token) {
    config.headers = config.headers || {};
    config.headers['x-stepup-session'] = token;
  }

  // Demo Mode is a client-side presentation toggle. Send it with every request so
  // server-side workflow checks can bypass date/time shift windows consistently.
  try {
    const demoEnabled = Object.keys(localStorage)
      .filter((key) => key.startsWith('kltn.prefs.'))
      .some((key) => JSON.parse(localStorage.getItem(key) || '{}')?.demoMode === true);
    if (demoEnabled) {
      config.headers = config.headers || {};
      config.headers['x-demo-mode'] = 'true';
    }
  } catch {
    // Ignore malformed preference payloads; normal validation still applies.
  }

  return config;
});

api.interceptors.response.use(
  (response) => {
    if (response.data && typeof response.data === 'object' && 'success' in response.data && 'data' in response.data) {
      return { ...response, data: response.data.data };
    }
    return response;
  },
  async (error) => {
    const original = error.config;
    const code = error.response?.data?.code || error.response?.data?.message?.code;

    // A Tier-B route rejected us because no privilege session is active (or it expired). Prompt a
    // single face scan to open one, then transparently replay the original request exactly once.
    if (error.response?.status === 403 && code === 'STEPUP_SESSION_REQUIRED' && original && !original.__stepUpRetried) {
      original.__stepUpRetried = true;
      stepUpSession.clear(); // discard any stale token before re-opening
      try {
        const token = await stepUpSession.ensure();
        original.headers = original.headers || {};
        original.headers['x-stepup-session'] = token;
        return api(original);
      } catch (e) {
        return Promise.reject(error); // user cancelled the scan or it failed
      }
    }
    return Promise.reject(error);
  },
);

export default api;

