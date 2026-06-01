import { AiImageAttachment } from './ai-provider-gateway.port';

/** DI token for the medical image attachment port. */
export const MEDICAL_IMAGE_ATTACHMENT = Symbol('MEDICAL_IMAGE_ATTACHMENT');

/** Minimal result-file shape needed to download an image for AI analysis. */
export type AttachableResultFile = {
  fileName: string;
  originalName: string;
  mimeType: string;
};

/**
 * Boundary for turning a visit's private medical-result images into base64
 * attachments for multimodal AI input. The adapter owns Cloudinary signing,
 * download, and the count/size caps.
 */
export interface MedicalImageAttachmentPort {
  collectImageAttachments(visit: any): Promise<AiImageAttachment[]>;
}
