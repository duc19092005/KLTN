import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import { IpfsArtifactService } from '../../../../infrastructure/audit/ipfs-artifact.service';
import { hashToBytes32 } from '../../../../infrastructure/audit/audit-hash.util';
import { EncryptionService } from '../../../encryption/services/encryption.service';
import { FaceRecoveryCheckpoint } from '../../application/ports/auth-chain-gateway.port';
import {
  CreatedFaceRecoveryArtifact,
  FaceRecoveryArtifactPort,
  RecoveredFaceTemplate,
} from '../../application/ports/face-recovery-artifact.port';
import { computeFaceHash, validateFaceDescriptorSet } from '../../domain/face.util';

const ENCRYPTED_SCHEMA = 'KLTN_ADMIN_FACE_RECOVERY_ENCRYPTED_V1';
const BUNDLE_SCHEMA = 'KLTN_ADMIN_FACE_RECOVERY_BUNDLE_V1';

type EncryptedEnvelope = {
  schema: typeof ENCRYPTED_SCHEMA;
  alg: 'AES-256-GCM';
  aad: string;
  payload: string;
};

type RecoveryBundle = {
  schema: typeof BUNDLE_SCHEMA;
  userId: string;
  faceHash: string;
  modelVersion: string;
  sampleCount: number;
  descriptors: number[][];
  createdAt: string;
};

@Injectable()
export class AdminFaceRecoveryArtifactAdapter implements FaceRecoveryArtifactPort {
  constructor(
    private readonly encryption: EncryptionService,
    private readonly ipfs: IpfsArtifactService,
  ) {}

  async createAndUpload(
    userId: string,
    descriptors: number[][],
    faceHash: string,
    modelVersion: string,
  ): Promise<CreatedFaceRecoveryArtifact> {
    const canonicalFaceHash = hashToBytes32(faceHash).toLowerCase();
    const aad = this.aad(userId, canonicalFaceHash);
    const bundle: RecoveryBundle = {
      schema: BUNDLE_SCHEMA,
      userId,
      faceHash: canonicalFaceHash,
      modelVersion,
      sampleCount: descriptors.length,
      descriptors,
      createdAt: new Date().toISOString(),
    };
    const envelope: EncryptedEnvelope = {
      schema: ENCRYPTED_SCHEMA,
      alg: 'AES-256-GCM',
      aad,
      payload: this.encryption.encryptSecret(JSON.stringify(bundle), aad),
    };
    const bytes = Buffer.from(JSON.stringify(envelope), 'utf8');
    const uploaded = await this.ipfs.upload(bytes, 'admin-face-recovery.enc', 'admin-face-recovery');
    return {
      artifactHash: this.hash(bytes),
      artifactUri: uploaded.uri,
    };
  }

  async downloadAndVerify(userId: string, checkpoint: FaceRecoveryCheckpoint): Promise<RecoveredFaceTemplate> {
    const bytes = await this.ipfs.download(checkpoint.artifactUri);
    if (this.hash(bytes) !== checkpoint.artifactHash.toLowerCase()) {
      throw new Error('Admin face recovery artifact hash mismatch.');
    }

    const envelope = this.parseEnvelope(bytes);
    const expectedAad = this.aad(userId, checkpoint.faceHash.toLowerCase());
    if (envelope.aad !== expectedAad) throw new Error('Admin face recovery artifact AAD mismatch.');

    const plaintext = this.encryption.decryptSecret(envelope.payload, expectedAad);
    const bundle = JSON.parse(plaintext) as Partial<RecoveryBundle>;
    if (
      bundle.schema !== BUNDLE_SCHEMA ||
      bundle.userId !== userId ||
      bundle.faceHash?.toLowerCase() !== checkpoint.faceHash.toLowerCase() ||
      typeof bundle.modelVersion !== 'string' ||
      bundle.modelVersion.length < 3 ||
      bundle.modelVersion.length > 64 ||
      !Array.isArray(bundle.descriptors)
    ) {
      throw new Error('Admin face recovery bundle is invalid.');
    }

    const descriptors = validateFaceDescriptorSet(bundle.descriptors);
    if (bundle.sampleCount !== descriptors.length) throw new Error('Admin face recovery sample count mismatch.');
    const recomputed = hashToBytes32(computeFaceHash(descriptors)).toLowerCase();
    if (recomputed !== checkpoint.faceHash.toLowerCase()) {
      throw new Error('Admin face recovery template does not match the on-chain face hash.');
    }
    return { descriptors, modelVersion: bundle.modelVersion };
  }

  private parseEnvelope(bytes: Buffer): EncryptedEnvelope {
    const value = JSON.parse(bytes.toString('utf8')) as Partial<EncryptedEnvelope>;
    if (value.schema !== ENCRYPTED_SCHEMA || value.alg !== 'AES-256-GCM' || !value.aad || !value.payload) {
      throw new Error('Unsupported Admin face recovery artifact schema.');
    }
    return value as EncryptedEnvelope;
  }

  private aad(userId: string, faceHash: string): string {
    const contextHash = createHash('sha256').update(`${userId}|${faceHash}`).digest('hex');
    return `KLTN_ADMIN_FACE_RECOVERY_V1|${contextHash}`;
  }

  private hash(bytes: Buffer): string {
    return `0x${createHash('sha256').update(bytes).digest('hex')}`;
  }
}
