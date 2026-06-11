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
  url: string;
};

/** Minimal file info needed to mint a signed download URL. */
export type SignableResultFile = {
  fileName: string;
  originalName: string;
  mimeType: string;
};

export type SignedDownloadUrl = {
  url: string;
  originalName: string;
  expiresAt: string;
};

/**
 * Storage boundary for medical result files. The Cloudinary adapter implements
 * upload (private/authenticated assets) and short-lived signed download URLs,
 * keeping that infrastructure concern out of the business service/use-cases.
 */
export interface MedicalResultStoragePort {
  uploadResultFiles(orderId: string, files: UploadedResultFileInput[]): Promise<StoredResultFile[]>;
  buildSignedDownloadUrl(file: SignableResultFile): SignedDownloadUrl;
}
