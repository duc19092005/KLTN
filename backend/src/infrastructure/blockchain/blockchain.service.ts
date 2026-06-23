import { Injectable, OnModuleInit } from '@nestjs/common';
import { ethers } from 'ethers';
import { computeBackendActionHash } from './blockchain-action-hash.util';

const LEGACY_SUPER_ADMIN_PLACEHOLDER = 'your_super_admin_private_key_here';

@Injectable()
export class BlockchainService implements OnModuleInit {
  private writeMutex: Promise<unknown> = Promise.resolve();

  private async enqueueWrite<T>(fn: () => Promise<T>): Promise<T> {
    const next = this.writeMutex.then(async () => {
      try {
        return await fn();
      } catch (err) {
        throw err;
      }
    });
    this.writeMutex = next.catch(() => {});
    return next;
  }

  private provider: ethers.JsonRpcProvider;
  private contract: ethers.Contract | null = null;
  private contractAddress = '';

  // Governance signer: root contract authority. For production, this should be
  // a cold wallet or multisig and must not live on the backend host.
  private ownerSigner: ethers.Wallet | null = null;

  // Operational signer: backend hot wallet used for routine on-chain writes.
  // It is intentionally separate from owner so it can be revoked/rotated.
  private relayerSigner: ethers.Wallet | null = null;

  // FaceRegistry: on-chain key-value store of face-template integrity hashes.
  private faceRegistry: ethers.Contract | null = null;
  private faceRegistryAddress = '';

  // AuditAnchor: append-only Merkle-root logger. The backend commits one Merkle root per batch
  // of audit logs (gas flat regardless of batch size); individual logs are never stored on-chain.
  private auditAnchor: ethers.Contract | null = null;
  private auditAnchorAddress = '';

  private readonly abi = [
    'function authorizeAdmin(address wallet) external',
    'function revokeAdmin(address wallet) external',
    'function isAuthorized(address wallet) external view returns (bool)',
    'function addRelayer(address wallet) external',
    'function removeRelayer(address wallet) external',
    'function isRelayer(address wallet) external view returns (bool)',
    'function isRelayerOrOwner(address wallet) external view returns (bool)',
    'function owner() external view returns (address)',
    'function pendingOwner() external view returns (address)',
    'function transferOwnership(address newOwner) external',
    'function acceptOwnership() external',
    'function recordAction(bytes32 actionHash) external',
  ];

  private readonly faceRegistryAbi = [
    'function setFaceHash(bytes32 key, bytes32 value) external',
    'function removeFaceHash(bytes32 key) external',
    'function getFaceHash(bytes32 key) external view returns (bytes32)',
    'function hasFaceHash(bytes32 key) external view returns (bool)',
    'function owner() external view returns (address)',
  ];

  private readonly auditAnchorAbi = [
    'function commitRoot(uint256 batchId, bytes32 root, uint256 leafCount) external',
    'function getRoot(uint256 batchId) external view returns (bytes32)',
    'function getCheckpoint(uint256 batchId) external view returns (bytes32 root, uint256 leafCount, uint256 timestamp, bool committed)',
    'function latestBatchId() external view returns (uint256)',
    'function totalBatches() external view returns (uint256)',
    'function owner() external view returns (address)',
  ];

  async onModuleInit() {
    const rpcUrl = process.env.BLOCKCHAIN_RPC_URL || 'http://127.0.0.1:8545';
    this.contractAddress = process.env.IDENTITY_REGISTRY_ADDRESS || '';
    this.provider = new ethers.JsonRpcProvider(rpcUrl);

    const legacyKey = this.validPrivateKey(process.env.SUPER_ADMIN_PRIVATE_KEY);
    const ownerKey = this.validPrivateKey(process.env.BLOCKCHAIN_OWNER_PRIVATE_KEY) || legacyKey;
    const relayerKey =
      this.validPrivateKey(process.env.BLOCKCHAIN_RELAYER_PRIVATE_KEY) ||
      this.validPrivateKey(process.env.BLOCKCHAIN_OWNER_PRIVATE_KEY) ||
      legacyKey;

    if (ownerKey) {
      this.ownerSigner = new ethers.Wallet(ownerKey, this.provider);
      console.log(`Blockchain owner signer initialized: ${this.ownerSigner.address}`);
      if (!process.env.BLOCKCHAIN_OWNER_PRIVATE_KEY && process.env.SUPER_ADMIN_PRIVATE_KEY) {
        console.warn('SUPER_ADMIN_PRIVATE_KEY is deprecated. Use BLOCKCHAIN_OWNER_PRIVATE_KEY for governance.');
      }
    } else {
      console.warn('BLOCKCHAIN_OWNER_PRIVATE_KEY not set. On-chain governance writes are disabled.');
    }

    if (relayerKey) {
      this.relayerSigner = new ethers.Wallet(relayerKey, this.provider);
      console.log(`Blockchain relayer signer initialized: ${this.relayerSigner.address}`);
      if (!process.env.BLOCKCHAIN_RELAYER_PRIVATE_KEY) {
        console.warn('BLOCKCHAIN_RELAYER_PRIVATE_KEY not set. Falling back to owner/legacy key for local development.');
      }
    } else {
      console.warn('BLOCKCHAIN_RELAYER_PRIVATE_KEY not set. On-chain operational writes are disabled.');
    }

    if (this.ownerSigner && this.relayerSigner && this.ownerSigner.address === this.relayerSigner.address) {
      console.warn('Blockchain owner and relayer are the same address. This is acceptable for local dev only.');
    }

    if (this.contractAddress) {
      this.contract = new ethers.Contract(this.contractAddress, this.abi, this.provider);
      console.log(`Connected to IdentityRegistry at ${this.contractAddress}`);
    } else {
      console.warn('IDENTITY_REGISTRY_ADDRESS not set. Blockchain checks disabled.');
    }

    this.faceRegistryAddress = process.env.FACE_REGISTRY_ADDRESS || '';
    if (this.faceRegistryAddress) {
      this.faceRegistry = new ethers.Contract(this.faceRegistryAddress, this.faceRegistryAbi, this.provider);
      console.log(`Connected to FaceRegistry at ${this.faceRegistryAddress}`);
    } else {
      console.warn('FACE_REGISTRY_ADDRESS not set. Face integrity anchoring disabled.');
    }

    this.auditAnchorAddress = process.env.AUDIT_ANCHOR_ADDRESS || '';
    if (this.auditAnchorAddress) {
      this.auditAnchor = new ethers.Contract(this.auditAnchorAddress, this.auditAnchorAbi, this.provider);
      console.log(`Connected to AuditAnchor at ${this.auditAnchorAddress}`);
    } else {
      console.warn('AUDIT_ANCHOR_ADDRESS not set. Audit Merkle-root anchoring disabled.');
    }
  }

  private validPrivateKey(value: string | undefined): string | null {
    if (!value || value === LEGACY_SUPER_ADMIN_PLACEHOLDER) return null;
    const trimmed = value.trim();
    if (/^0x[0-9a-fA-F]{64}$/.test(trimmed)) return trimmed;
    if (/^[0-9a-fA-F]{64}$/.test(trimmed)) return `0x${trimmed}`;
    return null;
  }

  // ---- FaceRegistry: face-template integrity anchoring ------------------------

  /** Derive the on-chain key for a user's face record from their UUID. */
  faceKey(userId: string): string {
    return ethers.keccak256(ethers.toUtf8Bytes(userId));
  }

  /** Whether the FaceRegistry contract is available for writes. */
  isFaceRegistryReady(): boolean {
    return Boolean(this.faceRegistry && this.relayerSigner);
  }

  /**
   * Mirror a user's face-template integrity hash on-chain (on enrollment).
   * @param userId off-chain user UUID
   * @param valueBytes32 0x-prefixed 32-byte SHA256 hash of the canonical face embedding JSON
   */
  async setFaceHash(userId: string, valueBytes32: string) {
    return this.enqueueWrite(async () => {
      if (!this.faceRegistry || !this.relayerSigner) {
        return { success: false, error: 'FaceRegistry or blockchain relayer key is not configured.' };
      }
      try {
        const key = this.faceKey(userId);
        const writable = this.faceRegistry.connect(this.relayerSigner) as ethers.Contract;
        const tx = await writable.setFaceHash(key, valueBytes32);
        const receipt = await tx.wait();
        return { success: true, key, txHash: tx.hash, blockNumber: receipt.blockNumber };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Failed to set face hash' };
      }
    });
  }

  /** Remove a user's face hash on-chain (used on biometric reset). */
  async removeFaceHash(userId: string) {
    return this.enqueueWrite(async () => {
      if (!this.faceRegistry || !this.relayerSigner) {
        return { success: false, error: 'FaceRegistry or blockchain relayer key is not configured.' };
      }
      try {
        const key = this.faceKey(userId);
        const exists = await this.faceRegistry.hasFaceHash(key);
        if (!exists) return { success: true, alreadyAbsent: true, key };
        const writable = this.faceRegistry.connect(this.relayerSigner) as ethers.Contract;
        const tx = await writable.removeFaceHash(key);
        const receipt = await tx.wait();
        return { success: true, key, txHash: tx.hash, blockNumber: receipt.blockNumber };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Failed to remove face hash' };
      }
    });
  }

  /**
   * Read the on-chain face hash for a user. Returns null if the registry is unavailable
   * or no hash is set (so the integrity gate can distinguish "not anchored").
   */
  async getFaceHash(userId: string): Promise<string | null> {
    if (!this.faceRegistry) return null;
    try {
      const key = this.faceKey(userId);
      const value: string = await this.faceRegistry.getFaceHash(key);
      if (!value || value === ethers.ZeroHash) return null;
      return value;
    } catch {
      return null;
    }
  }

  // ---- IdentityRegistry: admin authorization ----------------------------------

  async isAuthorized(walletAddress: string): Promise<boolean> {
    if (!this.contract) return false;
    try {
      return await this.contract.isAuthorized(ethers.getAddress(walletAddress));
    } catch {
      return false;
    }
  }

  async isRelayer(walletAddress: string): Promise<boolean> {
    if (!this.contract) return false;
    try {
      return await this.contract.isRelayer(ethers.getAddress(walletAddress));
    } catch {
      return false;
    }
  }

  async addRelayer(walletAddress: string) {
    return this.enqueueWrite(async () => {
      if (!this.contract || !this.ownerSigner) {
        return { success: false, error: 'IdentityRegistry or blockchain owner key is not configured.' };
      }
      try {
        const normalizedWalletAddress = ethers.getAddress(walletAddress);
        if (await this.isRelayer(normalizedWalletAddress)) {
          return { success: true, alreadyAuthorized: true };
        }
        const writableContract = this.contract.connect(this.ownerSigner) as ethers.Contract;
        const tx = await writableContract.addRelayer(normalizedWalletAddress);
        const receipt = await tx.wait();
        return { success: true, txHash: tx.hash, blockNumber: receipt.blockNumber };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Failed to authorize relayer' };
      }
    });
  }

  async removeRelayer(walletAddress: string) {
    return this.enqueueWrite(async () => {
      if (!this.contract || !this.ownerSigner) {
        return { success: false, error: 'IdentityRegistry or blockchain owner key is not configured.' };
      }
      try {
        const normalizedWalletAddress = ethers.getAddress(walletAddress);
        if (!(await this.isRelayer(normalizedWalletAddress))) {
          return { success: true, alreadyRevoked: true };
        }
        const writableContract = this.contract.connect(this.ownerSigner) as ethers.Contract;
        const tx = await writableContract.removeRelayer(normalizedWalletAddress);
        const receipt = await tx.wait();
        return { success: true, txHash: tx.hash, blockNumber: receipt.blockNumber };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Failed to revoke relayer' };
      }
    });
  }

  async authorizeAdmin(walletAddress: string) {
    return this.enqueueWrite(async () => {
      if (!this.contract || !this.relayerSigner) {
        return { success: false, error: 'IdentityRegistry or blockchain relayer key is not configured.' };
      }
      try {
        const normalizedWalletAddress = ethers.getAddress(walletAddress);
        if (await this.isAuthorized(normalizedWalletAddress)) {
          return { success: true, alreadyAuthorized: true };
        }
        const writableContract = this.contract.connect(this.relayerSigner) as ethers.Contract;
        const tx = await writableContract.authorizeAdmin(normalizedWalletAddress);
        const receipt = await tx.wait();
        return {
          success: true,
          txHash: tx.hash,
          blockNumber: receipt.blockNumber,
        };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Failed to authorize wallet' };
      }
    });
  }

  async revokeAdmin(walletAddress: string) {
    return this.enqueueWrite(async () => {
      if (!this.contract || !this.relayerSigner) {
        return { success: false, error: 'IdentityRegistry or blockchain relayer key is not configured.' };
      }
      try {
        const normalizedWalletAddress = ethers.getAddress(walletAddress);
        if (!(await this.isAuthorized(normalizedWalletAddress))) {
          return { success: true, alreadyRevoked: true };
        }
        const writableContract = this.contract.connect(this.relayerSigner) as ethers.Contract;
        const tx = await writableContract.revokeAdmin(normalizedWalletAddress);
        const receipt = await tx.wait();
        return {
          success: true,
          txHash: tx.hash,
          blockNumber: receipt.blockNumber,
        };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Failed to revoke wallet' };
      }
    });
  }

  async recordActionAsSuperAdmin(actionPayload: unknown) {
    return this.enqueueWrite(async () => {
      if (!this.contract || !this.relayerSigner) {
        return { success: false, error: 'IdentityRegistry or blockchain relayer key is not configured.' };
      }
      try {
        const actionHash = computeBackendActionHash(actionPayload);
        const writableContract = this.contract.connect(this.relayerSigner) as ethers.Contract;
        const tx = await writableContract.recordAction(actionHash);
        const receipt = await tx.wait();
        if (!receipt || receipt.status !== 1) {
          return { success: false, error: 'Backend-signed action transaction failed or was not confirmed.' };
        }
        return {
          success: true,
          signer: this.relayerSigner.address,
          actionHash,
          txHash: tx.hash,
          blockNumber: receipt.blockNumber,
        };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Failed to record backend-signed action' };
      }
    });
  }

  // ---- AuditAnchor: Merkle-root batch anchoring -------------------------------

  /** Whether the AuditAnchor contract is available for writes. */
  isAuditAnchorReady(): boolean {
    return Boolean(this.auditAnchor && this.relayerSigner);
  }

  /**
   * Commit the Merkle root of a sealed batch of audit logs on-chain. Exactly one transaction
   * per batch, regardless of how many logs it covers, so gas is flat. batchId must be unique
   * and monotonic; the contract rejects re-committing an existing batchId.
   * @param rootBytes32 0x-prefixed 32-byte Merkle root over the batch's entryHashes
   */
  async commitAuditRoot(batchId: number, rootBytes32: string, leafCount: number) {
    return this.enqueueWrite(async () => {
      if (!this.auditAnchor || !this.relayerSigner) {
        return { success: false, error: 'AuditAnchor or blockchain relayer key is not configured.' };
      }
      try {
        const writable = this.auditAnchor.connect(this.relayerSigner) as ethers.Contract;
        const tx = await writable.commitRoot(batchId, rootBytes32, leafCount);
        const receipt = await tx.wait();
        if (!receipt || receipt.status !== 1) {
          return { success: false, error: 'Audit root transaction failed or was not confirmed.' };
        }
        return { success: true, batchId, txHash: tx.hash, blockNumber: receipt.blockNumber };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Failed to commit audit root' };
      }
    });
  }

  /** Read the committed Merkle root for a batch. Returns null if unavailable or not committed. */
  async getAuditRoot(batchId: number): Promise<string | null> {
    if (!this.auditAnchor) return null;
    try {
      const value: string = await this.auditAnchor.getRoot(batchId);
      if (!value || value === ethers.ZeroHash) return null;
      return value;
    } catch {
      return null;
    }
  }

  /** Read the full on-chain checkpoint (root, leafCount, timestamp, committed) for a batch. */
  async getAuditCheckpoint(
    batchId: number,
  ): Promise<{ root: string; leafCount: number; timestamp: number; committed: boolean } | null> {
    if (!this.auditAnchor) return null;
    try {
      const [root, leafCount, timestamp, committed] = await this.auditAnchor.getCheckpoint(batchId);
      return {
        root,
        leafCount: Number(leafCount),
        timestamp: Number(timestamp),
        committed: Boolean(committed),
      };
    } catch {
      return null;
    }
  }

  /** Highest batchId committed on-chain, or null if the registry is unavailable. */
  async getLatestAuditBatchId(): Promise<number | null> {
    if (!this.auditAnchor) return null;
    try {
      const value = await this.auditAnchor.latestBatchId();
      return Number(value);
    } catch {
      return null;
    }
  }

  getContractAddress(): string {
    return this.contractAddress;
  }

  getOwnerAddress(): string | null {
    return this.ownerSigner?.address || null;
  }

  getRelayerAddress(): string | null {
    return this.relayerSigner?.address || null;
  }

  /** @deprecated Use getOwnerAddress() and getRelayerAddress() to avoid role confusion. */
  getSuperAdminAddress(): string | null {
    return this.getOwnerAddress();
  }
}
