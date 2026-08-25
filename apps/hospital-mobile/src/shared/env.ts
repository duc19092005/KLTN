const configuredBackendUrl = process.env.EXPO_PUBLIC_BACKEND_URL?.trim();

if (!configuredBackendUrl) {
  throw new Error('EXPO_PUBLIC_BACKEND_URL is required. Configure a reachable HTTPS or LAN backend URL before building.');
}

export const BACKEND_URL = configuredBackendUrl.replace(/\/$/, '');
