import { ethers } from 'ethers';

export class BlockchainAuditAnchorClient {
  private cachedLatestBatchId: { value: number | null; timestamp: number } | null = null;

  constructor(
    private readonly getAuditAnchor: () => ethers.Contract | null,
    private readonly getOwnerSigner: () => ethers.Wallet | null,
    private readonly getRelayerSigner: () => ethers.Wallet | null,
    private readonly enqueueWrite: <T>(fn: () => Promise<T>) => Promise<T>,
  ) {}

  async commitAuditCheckpointOnChain(
    batchId: number,
    merkleRootBytes32: string,
    leafCount: number,
    fromSeq: number,
    toSeq: number,
    artifactHashBytes32: string,
    artifactUri: string,
  ): Promise<{ success: boolean; txHash: string; blockNumber: number } | null> {
    const auditAnchor = this.getAuditAnchor();
    if (!auditAnchor) return null;
    const signer = this.getRelayerSigner() || this.getOwnerSigner();
    if (!signer) return null;

    try {
      return await this.enqueueWrite(async () => {
        const signedAnchor = auditAnchor.connect(signer) as ethers.Contract;
        const tx = await signedAnchor.getFunction('commitCheckpoint')(
          batchId,
          merkleRootBytes32,
          leafCount,
          fromSeq,
          toSeq,
          artifactHashBytes32,
          artifactUri,
        );
        const receipt = await tx.wait();
        this.cachedLatestBatchId = { value: batchId, timestamp: Date.now() };
        return {
          success: true,
          txHash: receipt.hash,
          blockNumber: Number(receipt.blockNumber),
        };
      });
    } catch (err) {
      console.error(`Failed to commitAuditCheckpoint for batch ${batchId}:`, err);
      return null;
    }
  }

  async getAuditRoot(batchId: number): Promise<string | null> {
    const auditAnchor = this.getAuditAnchor();
    if (!auditAnchor) return null;
    try {
      const value: string = await auditAnchor.getRoot(batchId);
      if (!value || value === ethers.ZeroHash) return null;
      return value;
    } catch {
      return null;
    }
  }

  async getAuditCheckpoint(
    batchId: number,
  ): Promise<{
    root: string;
    artifactHash: string;
    artifactUri: string;
    leafCount: number;
    fromSeq: number;
    toSeq: number;
    timestamp: number;
    committed: boolean;
  } | null> {
    const auditAnchor = this.getAuditAnchor();
    if (!auditAnchor) return null;
    try {
      const [root, artifactHash, artifactUri, leafCount, fromSeq, toSeq, timestamp, committed] = await auditAnchor.getCheckpoint(batchId);
      return {
        root,
        artifactHash,
        artifactUri,
        leafCount: Number(leafCount),
        fromSeq: Number(fromSeq),
        toSeq: Number(toSeq),
        timestamp: Number(timestamp),
        committed: Boolean(committed),
      };
    } catch {
      return null;
    }
  }

  async getAuditCheckpointsRange(fromBatchId: number, toBatchId: number): Promise<Array<{
    batchId: number;
    root: string;
    artifactHash: string;
    artifactUri: string;
    leafCount: number;
    fromSeq: number;
    toSeq: number;
    timestamp: number;
    committed: boolean;
  }>> {
    const auditAnchor = this.getAuditAnchor();
    if (!auditAnchor) return [];
    try {
      const items = await auditAnchor.getCheckpointsRange(fromBatchId, toBatchId);
      return (items || []).map((item: any) => ({
        batchId: Number(item.batchId),
        root: String(item.merkleRoot),
        artifactHash: String(item.artifactHash),
        artifactUri: String(item.artifactUri),
        leafCount: Number(item.leafCount),
        fromSeq: Number(item.fromSeq),
        toSeq: Number(item.toSeq),
        timestamp: Number(item.timestamp),
        committed: Boolean(item.committed),
      }));
    } catch {
      return [];
    }
  }

  async getAllCheckpoints(): Promise<Array<{
    batchId: number;
    root: string;
    artifactHash: string;
    artifactUri: string;
    leafCount: number;
    fromSeq: number;
    toSeq: number;
    timestamp: number;
    committed: boolean;
  }>> {
    const latest = await this.getLatestAuditBatchId();
    if (!latest || latest <= 0) return [];
    return this.getAuditCheckpointsRange(1, latest);
  }

  async getLatestAuditBatchId(forceRefresh = false): Promise<number | null> {
    const auditAnchor = this.getAuditAnchor();
    if (!auditAnchor) return null;
    const now = Date.now();
    if (!forceRefresh && this.cachedLatestBatchId && now - this.cachedLatestBatchId.timestamp < 15000) {
      return this.cachedLatestBatchId.value;
    }
    try {
      const value = await auditAnchor.latestBatchId();
      const num = Number(value);
      this.cachedLatestBatchId = { value: num, timestamp: now };
      return num;
    } catch {
      return this.cachedLatestBatchId?.value ?? null;
    }
  }
}