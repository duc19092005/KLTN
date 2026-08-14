/**
 * Canonical MedicalResult fields used by audit comparison and recovery.
 * Mirrors the CREATE audit snapshot written by create-medical-result.use-case.ts
 * (KLTN_MEDICAL_RESULT_AUDIT_V2). Files metadata is fully preserved because
 * medical result files are extremely sensitive.
 */
export function buildMedicalResultSnapshot(result: any) {
  const files = (result.files ?? []).map((file: any) => ({
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
    resultId: result.resultId ?? result.id ?? null,
    resultCode: result.resultCode,
    orderId: result.orderId,
    visitId: result.visitId ?? result.order?.visitId ?? null,
    performedById: result.performedById ?? null,
    files,
    fileCount: files.length,
    mimeTypes: files.map((file: any) => file.mimeType ?? 'unknown'),
    fileSizes: files.map((file: any) => file.size ?? 0),
    note: result.note ?? null,
    returnedAt: toIsoString(result.returnedAt ?? null),
    createdAt: toIsoString(result.createdAt ?? null),
  };
}

function toIsoString(value: Date | string | null): string | null {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : value;
}
