import { MedicalOrderStatus } from '@prisma/client';

export type MedicalResultFileAudit = {
  fileName: string | null;
  originalName: string | null;
  mimeType: string | null;
  size: number | null;
  url: string | null;
  storageProvider: string | null;
  bucket: string | null;
  objectKey: string | null;
  sha256: string | null;
  etag: string | null;
};

export type MedicalResultAuditSnapshot = {
  resultId: string;
  resultCode: string;
  orderId: string;
  visitId: string;
  performedById: string;
  fileCount: number;
  mimeTypes: string[];
  fileSizes: number[];
  /** Full per-file metadata. Sensitive — medical result files are private. */
  files: MedicalResultFileAudit[];
  status: MedicalOrderStatus;
  note: string | null;
  returnedAt: string | null;
  createdAt: string | null;
};

export type MedicalOrderStatusAuditSnapshot = {
  orderId: string;
  visitId: string;
  status: MedicalOrderStatus;
};

export type VisitStatusAuditSnapshot = {
  visitId: string;
  status: string;
};

type ResultFileLike = {
  fileName?: string | null;
  originalName?: string | null;
  mimeType?: string | null;
  size?: number | null;
  url?: string | null;
  storageProvider?: string | null;
  bucket?: string | null;
  objectKey?: string | null;
  sha256?: string | null;
  etag?: string | null;
};

type ResultLike = {
  id: string;
  resultCode: string;
  orderId: string;
  performedById: string;
  note?: string | null;
  returnedAt?: Date | string | null;
  createdAt?: Date | string | null;
  files?: ResultFileLike[];
};

export function buildMedicalResultAuditSnapshot(
  result: ResultLike,
  visitId: string,
  orderStatus: MedicalOrderStatus,
): MedicalResultAuditSnapshot {
  const files = (result.files ?? []).map((file) => ({
    fileName: file.fileName ?? null,
    originalName: file.originalName ?? null,
    mimeType: file.mimeType ?? null,
    size: file.size ?? null,
    url: file.url ?? null,
    storageProvider: file.storageProvider ?? null,
    bucket: file.bucket ?? null,
    objectKey: file.objectKey ?? null,
    sha256: file.sha256 ?? null,
    etag: file.etag ?? null,
  }));
  return {
    resultId: result.id,
    resultCode: result.resultCode,
    orderId: result.orderId,
    visitId,
    performedById: result.performedById,
    fileCount: files.length,
    mimeTypes: files.map((file) => file.mimeType ?? 'unknown'),
    fileSizes: files.map((file) => file.size ?? 0),
    files,
    status: orderStatus,
    note: result.note ?? null,
    returnedAt: toIsoString(result.returnedAt ?? null),
    createdAt: toIsoString(result.createdAt ?? null),
  };
}

export function buildMedicalOrderStatusAuditSnapshot(orderId: string, visitId: string, status: MedicalOrderStatus): MedicalOrderStatusAuditSnapshot {
  return { orderId, visitId, status };
}

export function buildVisitStatusAuditSnapshot(visitId: string, status: string): VisitStatusAuditSnapshot {
  return { visitId, status };
}

function toIsoString(value: Date | string | null): string | null {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : value;
}
