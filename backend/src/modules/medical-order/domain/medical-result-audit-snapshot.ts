import { MedicalOrderStatus } from '@prisma/client';

export type MedicalResultAuditSnapshot = {
  resultId: string;
  resultCode: string;
  orderId: string;
  visitId: string;
  performedById: string;
  fileCount: number;
  mimeTypes: string[];
  fileSizes: number[];
  status: MedicalOrderStatus;
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

type ResultLike = {
  id: string;
  resultCode: string;
  orderId: string;
  performedById: string;
  returnedAt?: Date | string | null;
  createdAt?: Date | string | null;
  files?: Array<{ mimeType?: string | null; size?: number | null }>;
};

export function buildMedicalResultAuditSnapshot(
  result: ResultLike,
  visitId: string,
  orderStatus: MedicalOrderStatus,
): MedicalResultAuditSnapshot {
  const files = result.files ?? [];
  return {
    resultId: result.id,
    resultCode: result.resultCode,
    orderId: result.orderId,
    visitId,
    performedById: result.performedById,
    fileCount: files.length,
    mimeTypes: files.map((file) => file.mimeType ?? 'unknown'),
    fileSizes: files.map((file) => file.size ?? 0),
    status: orderStatus,
    createdAt: toIsoString(result.returnedAt ?? result.createdAt ?? null),
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
