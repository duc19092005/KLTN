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
    'function rotateAdmin(address oldWallet, address newWallet) external',
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
    'function setFaceRecovery(bytes32 key, bytes32 faceHash, bytes32 artifactHash, string artifactUri) external',
    'function removeFaceHash(bytes32 key) external',
    'function getFaceHash(bytes32 key) external view returns (bytes32)',
    'function getFaceRecovery(bytes32 key) external view returns (bytes32 faceHash, bytes32 artifactHash, string artifactUri, bool isActive, uint256 updatedAt)',
    'function hasFaceHash(bytes32 key) external view returns (bool)',
    'function owner() external view returns (address)',
  ];

  private readonly auditAnchorAbi = [
    'function commitCheckpoint(uint256 batchId, bytes32 merkleRoot, uint256 leafCount, bytes32 artifactHash, string artifactUri) external',
    'function getRoot(uint256 batchId) external view returns (bytes32)',
    'function getCheckpoint(uint256 batchId) external view returns (bytes32 merkleRoot, bytes32 artifactHash, string artifactUri, uint256 leafCount, uint256 timestamp, bool committed)',
    'function getCheckpointsRange(uint256 fromBatchId, uint256 toBatchId) external view returns (tuple(uint256 batchId, bytes32 merkleRoot, bytes32 artifactHash, string artifactUri, uint256 leafCount, uint256 timestamp, bool committed)[] items)',
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
    }

    this.faceRegistryAddress = process.env.FACE_REGISTRY_ADDRESS || '';
    if (this.faceRegistryAddress) {
      this.faceRegistry = new ethers.Contract(this.faceRegistryAddress, this.faceRegistryAbi, this.provider);
    }

    this.auditAnchorAddress = process.env.AUDIT_ANCHOR_ADDRESS || '';
    if (this.auditAnchorAddress) {
      this.auditAnchor = new ethers.Contract(this.auditAnchorAddress, this.auditAnchorAbi, this.provider);
    }
  }

  private validPrivateKey(raw?: string): string | null {
    if (!raw) return null;
    const clean = raw.trim();
    if (!clean || clean === LEGACY_SUPER_ADMIN_PLACEHOLDER) return null;
    return clean.startsWith('0x') ? clean : `0x${clean}`;
  }

  isReady(): boolean {
    return Boolean(this.contract && (this.relayerSigner || this.ownerSigner));
  }

  isGovernanceReady(): boolean {
    return Boolean(this.contract && this.ownerSigner);
  }

  isFaceRegistryReady(): boolean {
    return Boolean(this.faceRegistry && (this.relayerSigner || this.ownerSigner));
  }

  isAuditAnchorReady(): boolean {
    return Boolean(this.auditAnchor && (this.relayerSigner || this.ownerSigner));
  }

  async isAuthorizedAdmin(walletAddress: string): Promise<boolean> {
    if (!this.contract) return false;
    try {
      return await this.contract.isAuthorized(walletAddress);
    } catch {
      return false;
    }
  }

  async isAuthorized(walletAddress: string): Promise<boolean> {
    return this.isAuthorizedAdmin(walletAddress);
  }

  async isRelayer(walletAddress: string): Promise<boolean> {
    if (!this.contract) return false;
    try {
      return await this.contract.isRelayer(walletAddress);
    } catch {
      return false;
    }
  }

  async isRelayerOrOwner(walletAddress: string): Promise<boolean> {
    if (!this.contract) return false;
    try {
      return await this.contract.isRelayerOrOwner(walletAddress);
    } catch {
      return false;
    }
  }

  async authorizeAdminOnChain(walletAddress: string): Promise<string> {
    if (!this.contract) throw new Error('Blockchain contract not initialized.');

    return this.enqueueWrite(async () => {
      const isAuth = await this.contract!.isAuthorized(walletAddress);
      if (isAuth) return 'ALREADY_AUTHORIZED';

      const signer = this.relayerSigner || this.ownerSigner;
      if (!signer) throw new Error('No operational signer configured for governance call.');

      const signedContract = this.contract!.connect(signer) as ethers.Contract;
      const tx = await signedContract.getFunction('authorizeAdmin')(walletAddress);
      const receipt = await tx.wait();
      return receipt.hash;
    });
  }

  async authorizeAdmin(walletAddress: string): Promise<string> {
    return this.authorizeAdminOnChain(walletAddress);
  }

  async revokeAdminOnChain(walletAddress: string): Promise<string> {
    if (!this.contract) throw new Error('Blockchain contract not initialized.');
    if (!this.ownerSigner) throw new Error('REVOKE_REQUIRES_OWNER: Only BLOCKCHAIN_OWNER_PRIVATE_KEY can revoke admins.');

    return this.enqueueWrite(async () => {
      const isAuth = await this.contract!.isAuthorized(walletAddress);
      if (!isAuth) return 'ALREADY_REVOKED';

      const signedContract = this.contract!.connect(this.ownerSigner!) as ethers.Contract;
      const tx = await signedContract.getFunction('revokeAdmin')(walletAddress);
      const receipt = await tx.wait();
      return receipt.hash;
    });
  }

  async rotateAdminOnChain(oldWallet: string, newWallet: string): Promise<string> {
    if (!this.contract) throw new Error('Blockchain contract not initialized.');

    return this.enqueueWrite(async () => {
      const isOldAuth = await this.contract!.isAuthorized(oldWallet);
      if (!isOldAuth) throw new Error(`Old wallet ${oldWallet} is not an authorized admin.`);

      const isNewAuth = await this.contract!.isAuthorized(newWallet);
      if (isNewAuth && oldWallet.toLowerCase() !== newWallet.toLowerCase()) {
        throw new Error(`New wallet ${newWallet} is already an authorized admin.`);
      }

      const signer = this.relayerSigner || this.ownerSigner;
      if (!signer) throw new Error('No operational signer configured for admin rotation.');

      const signedContract = this.contract!.connect(signer) as ethers.Contract;
      const tx = await signedContract.getFunction('rotateAdmin')(oldWallet, newWallet);
      const receipt = await tx.wait();
      return receipt.hash;
    });
  }

  async rotateAdmin(oldWallet: string, newWallet: string): Promise<string> {
    return this.rotateAdminOnChain(oldWallet, newWallet);
  }

  async recordActionOnChain(entityId: string, action: string, actorId: string): Promise<string | null> {
    if (!this.contract) return null;
    const signer = this.relayerSigner || this.ownerSigner;
    if (!signer) return null;

    try {
      const actionHash = computeBackendActionHash({ entityId, action, actorId });
      return await this.enqueueWrite(async () => {
        const signedContract = this.contract!.connect(signer) as ethers.Contract;
        const tx = await signedContract.getFunction('recordAction')(actionHash);
        const receipt = await tx.wait();
        return receipt.hash;
      });
    } catch (err) {
      console.error('Failed to record action on-chain:', err);
      return null;
    }
  }

  async addRelayerOnChain(walletAddress: string): Promise<string> {
    if (!this.contract) throw new Error('Blockchain contract not initialized.');
    if (!this.ownerSigner) throw new Error('Only BLOCKCHAIN_OWNER_PRIVATE_KEY can authorize relayers.');

    return this.enqueueWrite(async () => {
      const signedContract = this.contract!.connect(this.ownerSigner!) as ethers.Contract;
      const tx = await signedContract.getFunction('addRelayer')(walletAddress);
      const receipt = await tx.wait();
      return receipt.hash;
    });
  }

  async removeRelayerOnChain(walletAddress: string): Promise<string> {
    if (!this.contract) throw new Error('Blockchain contract not initialized.');
    if (!this.ownerSigner) throw new Error('Only BLOCKCHAIN_OWNER_PRIVATE_KEY can revoke relayers.');

    return this.enqueueWrite(async () => {
      const signedContract = this.contract!.connect(this.ownerSigner!) as ethers.Contract;
      const tx = await signedContract.getFunction('removeRelayer')(walletAddress);
      const receipt = await tx.wait();
      return receipt.hash;
    });
  }

  async setFaceHashOnChain(userKey: string, faceHashBytes32: string): Promise<string | null> {
    if (!this.faceRegistry) return null;
    const signer = this.relayerSigner || this.ownerSigner;
    if (!signer) return null;

    try {
      const keyBytes32 = ethers.keccak256(ethers.toUtf8Bytes(userKey));
      return await this.enqueueWrite(async () => {
        const signedRegistry = this.faceRegistry!.connect(signer) as ethers.Contract;
        const tx = await signedRegistry.getFunction('setFaceHash')(keyBytes32, faceHashBytes32);
        const receipt = await tx.wait();
        return receipt.hash;
      });
    } catch (err) {
      console.error(`Failed to setFaceHash on-chain for ${userKey}:`, err);
      return null;
    }
  }

  async setFaceHash(userKey: string, faceHashBytes32: string): Promise<string | null> {
    return this.setFaceHashOnChain(userKey, faceHashBytes32);
  }

  async setFaceRecoveryOnChain(
    userKey: string,
    faceHashBytes32: string,
    artifactHashBytes32: string,
    artifactUri: string,
  ): Promise<{ txHash: string; keyBytes32: string } | null> {
    if (!this.faceRegistry) return null;
    const signer = this.relayerSigner || this.ownerSigner;
    if (!signer) return null;

    try {
      const keyBytes32 = ethers.keccak256(ethers.toUtf8Bytes(userKey));
      const txHash = await this.enqueueWrite(async () => {
        const signedRegistry = this.faceRegistry!.connect(signer) as ethers.Contract;
        const tx = await signedRegistry.getFunction('setFaceRecovery')(
          keyBytes32,
          faceHashBytes32,
          artifactHashBytes32,
          artifactUri,
        );
        const receipt = await tx.wait();
        return receipt.hash;
      });
      return { txHash, keyBytes32 };
    } catch (err) {
      console.error(`Failed to setFaceRecovery on-chain for ${userKey}:`, err);
      return null;
    }
  }

  async setFaceRecovery(
    userKey: string,
    faceHashBytes32: string,
    artifactHashBytes32: string,
    artifactUri: string,
  ): Promise<{ txHash: string; keyBytes32: string } | null> {
    return this.setFaceRecoveryOnChain(userKey, faceHashBytes32, artifactHashBytes32, artifactUri);
  }

  async getFaceHashFromChain(userKey: string): Promise<string | null> {
    if (!this.faceRegistry) return null;
    try {
      const keyBytes32 = ethers.keccak256(ethers.toUtf8Bytes(userKey));
      const value: string = await this.faceRegistry.getFaceHash(keyBytes32);
      if (!value || value === ethers.ZeroHash) return null;
      return value;
    } catch {
      return null;
    }
  }

  async getFaceHash(userKey: string): Promise<string | null> {
    return this.getFaceHashFromChain(userKey);
  }

  async getFaceRecoveryFromChain(userKey: string): Promise<{
    faceHash: string;
    artifactHash: string;
    artifactUri: string;
    isActive: boolean;
    updatedAt: number;
  } | null> {
    if (!this.faceRegistry) return null;
    try {
      const keyBytes32 = ethers.keccak256(ethers.toUtf8Bytes(userKey));
      const [faceHash, artifactHash, artifactUri, isActive, updatedAt] =
        await this.faceRegistry.getFaceRecovery(keyBytes32);
      if (!isActive || !artifactUri || artifactHash === ethers.ZeroHash) return null;
      return {
        faceHash,
        artifactHash,
        artifactUri,
        isActive: Boolean(isActive),
        updatedAt: Number(updatedAt),
      };
    } catch {
      return null;
    }
  }

  async getFaceRecovery(userKey: string) {
    return this.getFaceRecoveryFromChain(userKey);
  }

  async commitAuditCheckpointOnChain(
    batchId: number,
    merkleRootBytes32: string,
    leafCount: number,
    artifactHashBytes32: string,
    artifactUri: string,
  ): Promise<{ success: boolean; txHash: string; blockNumber: number } | null> {
    if (!this.auditAnchor) return null;
    const signer = this.relayerSigner || this.ownerSigner;
    if (!signer) return null;

    try {
      return await this.enqueueWrite(async () => {
        const signedAnchor = this.auditAnchor!.connect(signer) as ethers.Contract;
        const tx = await signedAnchor.getFunction('commitCheckpoint')(
          batchId,
          merkleRootBytes32,
          leafCount,
          artifactHashBytes32,
          artifactUri,
        );
        const receipt = await tx.wait();
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

  async commitAuditCheckpoint(
    batchId: number,
    merkleRootBytes32: string,
    leafCount: number,
    artifactHashBytes32: string,
    artifactUri: string,
  ): Promise<{ success: boolean; txHash: string; blockNumber: number } | null> {
    return this.commitAuditCheckpointOnChain(batchId, merkleRootBytes32, leafCount, artifactHashBytes32, artifactUri);
  }

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

  async getAuditCheckpoint(
    batchId: number,
  ): Promise<{
    root: string;
    artifactHash: string;
    artifactUri: string;
    leafCount: number;
    timestamp: number;
    committed: boolean;
  } | null> {
    if (!this.auditAnchor) return null;
    try {
      const [root, artifactHash, artifactUri, leafCount, timestamp, committed] = await this.auditAnchor.getCheckpoint(batchId);
      return {
        root,
        artifactHash,
        artifactUri,
        leafCount: Number(leafCount),
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
    timestamp: number;
    committed: boolean;
  }>> {
    if (!this.auditAnchor) return [];
    try {
      const items = await this.auditAnchor.getCheckpointsRange(fromBatchId, toBatchId);
      return (items || []).map((item: any) => ({
        batchId: Number(item.batchId),
        root: String(item.merkleRoot),
        artifactHash: String(item.artifactHash),
        artifactUri: String(item.artifactUri),
        leafCount: Number(item.leafCount),
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
    timestamp: number;
    committed: boolean;
  }>> {
    const latest = await this.getLatestAuditBatchId();
    if (!latest || latest <= 0) return [];
    return this.getAuditCheckpointsRange(1, latest);
  }

  private cachedLatestBatchId: { value: number | null; timestamp: number } | null = null;

  async getLatestAuditBatchId(forceRefresh = false): Promise<number | null> {
    if (!this.auditAnchor) return null;
    const now = Date.now();
    if (!forceRefresh && this.cachedLatestBatchId && now - this.cachedLatestBatchId.timestamp < 15000) {
      return this.cachedLatestBatchId.value;
    }
    try {
      const value = await this.auditAnchor.latestBatchId();
      const num = Number(value);
      this.cachedLatestBatchId = { value: num, timestamp: now };
      return num;
    } catch {
      return this.cachedLatestBatchId?.value ?? null;
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

  getSuperAdminAddress(): string | null {
    return this.getOwnerAddress();
  }
}
