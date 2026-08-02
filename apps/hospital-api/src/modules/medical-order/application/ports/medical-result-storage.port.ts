/** DI token for the medical-result file storage port. */
export const MEDICAL_RESULT_STORAGE = Symbol('MEDICAL_RESULT_STORAGE');

/** A raw uploaded file (multer memory storage shape). */
export type UploadedResultFileInput = {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
};

/** Persisted file descriptor returned after upload (matches MedicalResultFile create input). */
export type StoredResultFile = {
  fileName: string;
  originalName: string;
  mimeType: string;
  size: number;
  url?: string | null;
  storageProvider: 'S3' | 'CLOUDINARY';
  bucket?: string | null;
  objectKey?: string | null;
  sha256?: string | null;
  etag?: string | null;
};

/** Minimal file info needed to mint a signed download URL. */
export type SignableResultFile = {
  fileName: string;
  originalName: string;
  mimeType: string;
  url?: string | null;
  storageProvider?: string | null;
  bucket?: string | null;
  objectKey?: string | null;
};

export type SignedDownloadUrl = {
  url: string;
  originalName: string;
  expiresAt: string;
};

/**
 * Storage boundary for medical result files. The S3 adapter implements
 * upload (private bucket objects) and short-lived signed download URLs,
 * keeping that infrastructure concern out of the business service/use-cases.
 */
export interface MedicalResultStoragePort {
  uploadResultFiles(orderId: string, files: UploadedResultFileInput[]): Promise<StoredResultFile[]>;
  buildSignedDownloadUrl(file: SignableResultFile): Promise<SignedDownloadUrl>;
}
