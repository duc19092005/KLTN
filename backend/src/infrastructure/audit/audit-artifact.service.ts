import { Injectable } from '@nestjs/common';
import { AuditRecoveryCryptoService } from './audit-recovery-crypto.service';
import { IpfsArtifactService } from './ipfs-artifact.service';

export interface AuditRecoveryBundleRow {
  id: string;
  eventId: string | null;
  seq: number;
  prevHash: string;
  entryHash: string;
  actorId: string | null;
  action: string;
  entity: string;
  entityId: string | null;
  metadata: unknown;
  dataHash: string | null;
  dataSalt: string | null;
  beforeJson: unknown;
  afterJson: unknown;
  beforeHash: string | null;
  afterHash: string | null;
  diffHash: string | null;
  hashVersion: string | null;
  beforeEncrypted: unknown;
  afterEncrypted: unknown;
  encryptionVersion: string | null;
  encryptionKeyId: string | null;
  diffJson: unknown;
  fieldsChanged: unknown;
  departmentId: string | null;
  staffProfileId: string | null;
  doctorProfileId: string | null;
  patientId: string | null;
  aiModelRegistryId: string | null;
  medicalConclusionId: string | null;
  aiQualityId: string | null;
  createdAt: string;
}

export interface AuditRecoveryBundle {
  schema: 'KLTN_AUDIT_RECOVERY_BUNDLE_V1';
  batch: {
    batchId: number;
    merkleRoot: string;
    leafCount: number;
    fromSeq: number;
    toSeq: number;
    algorithmVersion: string;
  };
  logs: AuditRecoveryBundleRow[];
}

@Injectable()
export class AuditArtifactService {
  constructor(
    private readonly crypto: AuditRecoveryCryptoService,
    private readonly ipfs: IpfsArtifactService,
  ) {}

  isReady(): boolean {
    try {
      this.assertReady();
      return true;
    } catch {
      return false;
    }
  }

  assertReady(): void {
    if (!this.ipfs.isReady()) {
      throw new Error('Audit recovery IPFS is not configured.');
    }
    this.crypto.assertReady();
  }

  async createAndUpload(input: AuditRecoveryBundle): Promise<{
    artifactHash: string;
    artifactUri: string;
    artifactCid: string;
    artifactKeyId: string;
  }> {
    const plaintext = Buffer.from(JSON.stringify(input), 'utf8');
    const encrypted = await this.crypto.encrypt(plaintext, input.batch.batchId);
    const uploaded = await this.ipfs.upload(encrypted.bytes, `audit-batch-${input.batch.batchId}.json`);
    return {
      artifactHash: encrypted.artifactHash,
      artifactUri: uploaded.uri,
      artifactCid: uploaded.cid,
      artifactKeyId: encrypted.keyId,
    };
  }

  async downloadAndDecrypt(batchId: number, artifactUri: string, artifactHash: string): Promise<AuditRecoveryBundle> {
    const bytes = await this.ipfs.download(artifactUri);
    const actualHash = this.crypto.hash(bytes);
    if (actualHash.toLowerCase() !== artifactHash.toLowerCase()) {
      throw new Error('IPFS artifact hash does not match the blockchain checkpoint.');
    }
    const plaintext = await this.crypto.decrypt(bytes, batchId);
    const bundle = JSON.parse(plaintext.toString('utf8')) as Partial<AuditRecoveryBundle>;
    if (bundle.schema !== 'KLTN_AUDIT_RECOVERY_BUNDLE_V1' || bundle.batch?.batchId !== batchId || !Array.isArray(bundle.logs)) {
      throw new Error('Recovery bundle schema or batch id is invalid.');
    }
    return bundle as AuditRecoveryBundle;
  }
}
