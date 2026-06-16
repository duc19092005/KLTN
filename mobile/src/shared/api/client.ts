import { BACKEND_URL } from '../env';
import { KLTNNfcCard, PatientNfcLoginResponse } from '../types/nfc';

type ApiEnvelope<T> = {
  success?: boolean;
  message?: string;
  data?: T;
};

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init: RequestInit): Promise<T> {
  const response = await fetch(`${BACKEND_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });
  const payload = (await response.json().catch(() => null)) as ApiEnvelope<T> | null;

  if (!response.ok) {
    const message = Array.isArray(payload?.message)
      ? payload.message.join('\n')
      : payload?.message || `Request failed with status ${response.status}`;
    throw new ApiError(message, response.status);
  }

  return payload && 'data' in payload && payload.data !== undefined ? payload.data : (payload as T);
}

export function submitReceptionistNfcResult(input: {
  sessionId: string;
  mobileToken: string;
  card: KLTNNfcCard;
  scannerDeviceLabel: string;
}) {
  return request('/mobile/receptionist/nfc-sessions/' + encodeURIComponent(input.sessionId) + '/result', {
    method: 'POST',
    body: JSON.stringify({
      mobileToken: input.mobileToken,
      scannerDeviceLabel: input.scannerDeviceLabel,
      card: input.card,
    }),
  });
}

export function loginPatientWithNfc(card: KLTNNfcCard) {
  return request<PatientNfcLoginResponse>('/mobile/patient/nfc-login', {
    method: 'POST',
    body: JSON.stringify({ card }),
  });
}
