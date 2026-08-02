import { FaceRecoveryCheckpoint } from './auth-chain-gateway.port';

export const FACE_RECOVERY_ARTIFACT = Symbol('FACE_RECOVERY_ARTIFACT');

export type CreatedFaceRecoveryArtifact = {
  artifactHash: string;
  artifactUri: string;
};

export type RecoveredFaceTemplate = {
  descriptors: number[][];
  modelVersion: string;
};

export interface FaceRecoveryArtifactPort {
  createAndUpload(
    userId: string,
    descriptors: number[][],
    faceHash: string,
    modelVersion: string,
  ): Promise<CreatedFaceRecoveryArtifact>;

  downloadAndVerify(userId: string, checkpoint: FaceRecoveryCheckpoint): Promise<RecoveredFaceTemplate>;
}
