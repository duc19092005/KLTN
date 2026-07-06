import { BACKEND_URL } from '../env';

export type PatientProfileAccess = {
  accessId: string;
  relationship: string;
  permissions: {
    canViewProfile: boolean;
    canViewVisits: boolean;
    canViewResults: boolean;
    canBookVisit: boolean;
  };
  patient: PatientSummary;
};

export type PatientSummary = {
  id: string;
  patientCode: string;
  fullName: string;
  gender: string;
  birthDate: string;
  citizenId?: string | null;
  contactPhone?: string | null;
  phone?: string | null;
  address?: string | null;
  insuranceNumber?: string | null;
  emergencyContact?: string | null;
};

export type PatientVisitSummary = {
  id: string;
  visitCode: string;
  status: string;
  source?: string;
  checkInAt: string;
  completedAt?: string | null;
  reason?: string | null;
  symptoms?: string | null;
  department?: { id: string; name: string; type: string } | null;
  doctor?: { id: string; fullName: string } | null;
  finalDiagnosis?: string | null;
};

export type PatientResultFile = {
  id: string;
  originalName: string;
  mimeType: string;
  size: number;
  storageProvider: string;
  isImage?: boolean;
  downloadPath?: string;
};

export type PatientFileDownload = {
  url: string;
  originalName: string;
  expiresAt: string;
};

export type PatientAiDiagnosis = {
  id: string;
  result?: string | null;
  confidence?: number | null;
  status?: string | null;
  createdAt?: string | null;
  aiModel?: { id: string; modelName?: string | null; modelVersion?: string | null; provider?: string | null } | null;
};

export type PatientVisitDetail = PatientVisitSummary & {
  patient: PatientSummary;
  conclusion?: {
    id: string;
    finalDiagnosis: string;
    treatmentPlan?: string | null;
    prescription?: string | null;
    followUpNote?: string | null;
    doctorNote?: string | null;
    concludedAt: string;
    doctor?: string | null;
  } | null;
  aiDiagnoses?: PatientAiDiagnosis[];
  orders: Array<{
    id: string;
    orderCode: string;
    orderType: string;
    priority: string;
    clinicalNote?: string | null;
    status: string;
    orderedAt: string;
    completedAt?: string | null;
    targetDepartment?: { id: string; name: string } | null;
    results: Array<{
      id: string;
      resultCode: string;
      note?: string | null;
      returnedAt: string;
      files: PatientResultFile[];
    }>;
  }>;
};

export type CreatePatientProfilePayload = {
  fullName: string;
  gender: string;
  birthDate: string;
  citizenId?: string;
  phone?: string;
  address?: string;
  insuranceNumber?: string;
  emergencyContact?: string;
};

export type BookableSpecialty = { value: string; label: string; doctorCount: number };
export type BookableDoctor = { id: string; staffProfileId: string; fullName: string; specialty?: string | null; specialtyLabel?: string | null; qualification?: string | null; yearsExperience?: number | null; department?: { id: string; departmentCode?: string | null; name: string; floor?: string | null } | null };
export type AppointmentSlot = { startAt: string; available: boolean };

export type PatientAppointment = {
  id: string;
  appointmentCode: string;
  scheduledAt: string;
  reason?: string | null;
  symptoms?: string | null;
  status: string;
  qrExpiresAt: string;
  checkedInAt?: string | null;
  qrPayload?: string;
  patient?: PatientSummary | null;
  department?: { id: string; name: string; type?: string; floor?: string | null } | null;
  doctor?: { id: string; fullName: string; specialty?: string | null } | null;
  visitId?: string | null;
};

export type CreateAppointmentPayload = {
  patientId: string;
  specialty: string;
  doctorId: string;
  scheduledAt: string;
  reason?: string;
  symptoms?: string;
};

type ApiEnvelope<T> = {
  success?: boolean;
  message?: string | string[];
  data?: T;
};

async function request<T>(path: string, token: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${BACKEND_URL}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const payload = (await response.json().catch(() => null)) as ApiEnvelope<T> | null;
  if (!response.ok) {
    const message = Array.isArray(payload?.message)
      ? payload.message.join('\n')
      : payload?.message || `Request failed with status ${response.status}`;
    throw new Error(message);
  }
  return payload && 'data' in payload && payload.data !== undefined ? payload.data : (payload as T);
}

export function getPatientProfiles(token: string) {
  return request<PatientProfileAccess[]>('/patient/me/profiles', token);
}

export function createPatientProfile(token: string, payload: CreatePatientProfilePayload) {
  return request<PatientSummary>('/patient/me/profiles', token, { method: 'POST', body: JSON.stringify(payload) });
}

export function getPatientVisits(token: string, patientId: string) {
  return request<PatientVisitSummary[]>(`/patient/me/profiles/${encodeURIComponent(patientId)}/visits`, token);
}

export function getPatientVisitDetail(token: string, patientId: string, visitId: string) {
  return request<PatientVisitDetail>(`/patient/me/profiles/${encodeURIComponent(patientId)}/visits/${encodeURIComponent(visitId)}`, token);
}

export function getPatientResultFileDownloadUrl(token: string, patientId: string, fileId: string) {
  return request<PatientFileDownload>(`/patient/me/profiles/${encodeURIComponent(patientId)}/files/${encodeURIComponent(fileId)}/download`, token);
}

export function getBookableSpecialties(token: string) {
  return request<BookableSpecialty[]>('/patient/me/booking/specialties', token);
}

export function getBookableDoctorsBySpecialty(token: string, specialty: string) {
  return request<BookableDoctor[]>(`/patient/me/booking/specialties/${encodeURIComponent(specialty)}/doctors`, token);
}

export function getAppointmentSlots(token: string, doctorId: string, date: string) {
  return request<AppointmentSlot[]>(`/patient/me/booking/doctors/${encodeURIComponent(doctorId)}/slots?date=${encodeURIComponent(date)}`, token);
}

export function createAppointment(token: string, payload: CreateAppointmentPayload) {
  return request<PatientAppointment>('/patient/me/appointments', token, { method: 'POST', body: JSON.stringify(payload) });
}

export function getPatientAppointments(token: string, patientId?: string) {
  const query = patientId ? `?patientId=${encodeURIComponent(patientId)}` : '';
  return request<PatientAppointment[]>(`/patient/me/appointments${query}`, token);
}

export function getAppointmentQr(token: string, appointmentId: string) {
  return request<PatientAppointment>(`/patient/me/appointments/${encodeURIComponent(appointmentId)}/qr`, token);
}

export function cancelAppointment(token: string, appointmentId: string) {
  return request<PatientAppointment>(`/patient/me/appointments/${encodeURIComponent(appointmentId)}`, token, { method: 'DELETE' });
}
