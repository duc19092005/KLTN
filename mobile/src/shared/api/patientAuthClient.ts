import { BACKEND_URL } from '../env';

export type PatientOtpRequestResponse = {
  success: boolean;
  message: string;
  resendAfterSeconds: number;
  canResendAt: string;
  otpExpiresAt: string;
};

export type PatientOtpLoginResponse = {
  accessToken: string;
  requirePasswordSetup?: boolean;
  user?: {
    id: string;
    phone?: string | null;
    phoneNormalized?: string | null;
  };
  patients: Array<{
    id: string;
    patientCode: string;
    fullName: string;
    phone?: string | null;
  }>;
};

type ApiEnvelope<T> = {
  success?: boolean;
  message?: string;
  data?: T;
};

export class PatientAuthApiError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
  ) {
    super(message);
  }
}

async function request<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${BACKEND_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const payload = (await response.json().catch(() => null)) as ApiEnvelope<T> | null;

  if (!response.ok) {
    const message = Array.isArray(payload?.message)
      ? payload.message.join('\n')
      : payload?.message || `Request failed with status ${response.status}`;
    throw new PatientAuthApiError(message, response.status);
  }

  return payload && 'data' in payload && payload.data !== undefined ? payload.data : (payload as T);
}

export function requestPatientOtp(phone: string) {
  return request<PatientOtpRequestResponse>('/patient/auth/request-otp', { phone });
}

export function resendPatientOtp(phone: string) {
  return request<PatientOtpRequestResponse>('/patient/auth/resend-otp', { phone });
}

export function verifyPatientOtp(phone: string, otp: string, newPassword?: string) {
  return request<PatientOtpLoginResponse>('/patient/auth/verify-otp', { phone, otp, ...(newPassword ? { newPassword } : {}) });
}

export function passwordPatientLogin(phone: string, password: string) {
  return request<PatientOtpLoginResponse>('/patient/auth/password-login', { phone, password });
}
