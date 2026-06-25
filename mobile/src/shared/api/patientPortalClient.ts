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
  address?: string | null;
  insuranceNumber?: string | null;
  emergencyContact?: string | null;
};

export type PatientVisitSummary = {
  id: string;
  visitCode: string;
  status: string;
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

export type PatientVisitDetail = PatientVisitSummary & {
  initialDiagnosis?: string | null;
  note?: string | null;
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

type ApiEnvelope<T> = {
  success?: boolean;
  message?: string;
  data?: T;
};

async function request<T>(path: string, token: string): Promise<T> {
  const response = await fetch(`${BACKEND_URL}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
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

export function getPatientVisits(token: string, patientId: string) {
  return request<PatientVisitSummary[]>(`/patient/me/profiles/${encodeURIComponent(patientId)}/visits`, token);
}

export function getPatientVisitDetail(token: string, patientId: string, visitId: string) {
  return request<PatientVisitDetail>(`/patient/me/profiles/${encodeURIComponent(patientId)}/visits/${encodeURIComponent(visitId)}`, token);
}

export function getPatientResultFileDownloadUrl(token: string, patientId: string, fileId: string) {
  return request<PatientFileDownload>(`/patient/me/profiles/${encodeURIComponent(patientId)}/files/${encodeURIComponent(fileId)}/download`, token);
}
