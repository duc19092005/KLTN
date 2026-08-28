import { Injectable, OnModuleInit } from '@nestjs/common';
import { ethers } from 'ethers';
import { BlockchainGovernanceClient } from './clients/blockchain-governance.client';
import { BlockchainFaceRegistryClient } from './clients/blockchain-face-registry.client';
import { BlockchainAuditAnchorClient } from './clients/blockchain-audit-anchor.client';

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
  private ownerSigner: ethers.Wallet | null = null;
  private relayerSigner: ethers.Wallet | null = null;
  private faceRegistry: ethers.Contract | null = null;
  private faceRegistryAddress = '';
  private auditAnchor: ethers.Contract | null = null;
  private auditAnchorAddress = '';

  private governanceClient: BlockchainGovernanceClient;
  private faceRegistryClient: BlockchainFaceRegistryClient;
  private auditAnchorClient: BlockchainAuditAnchorClient;

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
    'function commitCheckpoint(uint256 batchId, bytes32 merkleRoot, uint256 leafCount, uint256 fromSeq, uint256 toSeq, bytes32 artifactHash, string artifactUri) external',
    'function getRoot(uint256 batchId) external view returns (bytes32)',
    'function getCheckpoint(uint256 batchId) external view returns (bytes32 merkleRoot, bytes32 artifactHash, string artifactUri, uint256 leafCount, uint256 fromSeq, uint256 toSeq, uint256 timestamp, bool committed)',
    'function getCheckpointsRange(uint256 fromBatchId, uint256 toBatchId) external view returns (tuple(uint256 batchId, bytes32 merkleRoot, bytes32 artifactHash, string artifactUri, uint256 leafCount, uint256 fromSeq, uint256 toSeq, uint256 timestamp, bool committed)[] items)',
    'function latestBatchId() external view returns (uint256)',
    'function totalBatches() external view returns (uint256)',
    'function owner() external view returns (address)',
  ];

  constructor() {
    this.governanceClient = new BlockchainGovernanceClient(
      () => this.contract,
      () => this.ownerSigner,
      () => this.relayerSigner,
      (fn) => this.enqueueWrite(fn),
    );
    this.faceRegistryClient = new BlockchainFaceRegistryClient(
      () => this.faceRegistry,
      () => this.ownerSigner,
      () => this.relayerSigner,
      (fn) => this.enqueueWrite(fn),
    );
    this.auditAnchorClient = new BlockchainAuditAnchorClient(
      () => this.auditAnchor,
      () => this.ownerSigner,
      () => this.relayerSigner,
      (fn) => this.enqueueWrite(fn),
    );
  }

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
    }
    if (relayerKey) {
      this.relayerSigner = new ethers.Wallet(relayerKey, this.provider);
      console.log(`Blockchain relayer signer initialized: ${this.relayerSigner.address}`);
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
    return this.governanceClient.isAuthorizedAdmin(walletAddress);
  }

  async isAuthorized(walletAddress: string): Promise<boolean> {
    return this.governanceClient.isAuthorizedAdmin(walletAddress);
  }

  async isRelayer(walletAddress: string): Promise<boolean> {
    return this.governanceClient.isRelayer(walletAddress);
  }

  async isRelayerOrOwner(walletAddress: string): Promise<boolean> {
    return this.governanceClient.isRelayerOrOwner(walletAddress);
  }

  async authorizeAdminOnChain(walletAddress: string): Promise<string> {
    return this.governanceClient.authorizeAdminOnChain(walletAddress);
  }

  async authorizeAdmin(walletAddress: string): Promise<string> {
    return this.governanceClient.authorizeAdminOnChain(walletAddress);
  }

  async revokeAdminOnChain(walletAddress: string): Promise<string> {
    return this.governanceClient.revokeAdminOnChain(walletAddress);
  }

  async rotateAdminOnChain(oldWallet: string, newWallet: string): Promise<string> {
    return this.governanceClient.rotateAdminOnChain(oldWallet, newWallet);
  }

  async rotateAdmin(oldWallet: string, newWallet: string): Promise<string> {
    return this.governanceClient.rotateAdminOnChain(oldWallet, newWallet);
  }

  async recordActionOnChain(entityId: string, action: string, actorId: string): Promise<string | null> {
    return this.governanceClient.recordActionOnChain(entityId, action, actorId);
  }

  async addRelayerOnChain(walletAddress: string): Promise<string> {
    return this.governanceClient.addRelayerOnChain(walletAddress);
  }

  async removeRelayerOnChain(walletAddress: string): Promise<string> {
    return this.governanceClient.removeRelayerOnChain(walletAddress);
  }

  async setFaceHashOnChain(userKey: string, faceHashBytes32: string): Promise<string | null> {
    return this.faceRegistryClient.setFaceHashOnChain(userKey, faceHashBytes32);
  }

  async setFaceHash(userKey: string, faceHashBytes32: string): Promise<string | null> {
    return this.faceRegistryClient.setFaceHashOnChain(userKey, faceHashBytes32);
  }

  async setFaceRecoveryOnChain(
    userKey: string,
    faceHashBytes32: string,
    artifactHashBytes32: string,
    artifactUri: string,
  ): Promise<{ txHash: string; keyBytes32: string } | null> {
    return this.faceRegistryClient.setFaceRecoveryOnChain(userKey, faceHashBytes32, artifactHashBytes32, artifactUri);
  }

  async setFaceRecovery(
    userKey: string,
    faceHashBytes32: string,
    artifactHashBytes32: string,
    artifactUri: string,
  ): Promise<{ txHash: string; keyBytes32: string } | null> {
    return this.faceRegistryClient.setFaceRecoveryOnChain(userKey, faceHashBytes32, artifactHashBytes32, artifactUri);
  }

  async getFaceHashFromChain(userKey: string): Promise<string | null> {
    return this.faceRegistryClient.getFaceHashFromChain(userKey);
  }

  async getFaceHash(userKey: string): Promise<string | null> {
    return this.faceRegistryClient.getFaceHashFromChain(userKey);
  }

  async getFaceRecoveryFromChain(userKey: string) {
    return this.faceRegistryClient.getFaceRecoveryFromChain(userKey);
  }

  async getFaceRecovery(userKey: string) {
    return this.faceRegistryClient.getFaceRecoveryFromChain(userKey);
  }

  async commitAuditCheckpointOnChain(
    batchId: number,
    merkleRootBytes32: string,
    leafCount: number,
    fromSeq: number,
    toSeq: number,
    artifactHashBytes32: string,
    artifactUri: string,
  ) {
    return this.auditAnchorClient.commitAuditCheckpointOnChain(
      batchId,
      merkleRootBytes32,
      leafCount,
      fromSeq,
      toSeq,
      artifactHashBytes32,
      artifactUri,
    );
  }

  async commitAuditCheckpoint(
    batchId: number,
    merkleRootBytes32: string,
    leafCount: number,
    fromSeq: number,
    toSeq: number,
    artifactHashBytes32: string,
    artifactUri: string,
  ) {
    return this.auditAnchorClient.commitAuditCheckpointOnChain(
      batchId,
      merkleRootBytes32,
      leafCount,
      fromSeq,
      toSeq,
      artifactHashBytes32,
      artifactUri,
    );
  }

  async getAuditRoot(batchId: number): Promise<string | null> {
    return this.auditAnchorClient.getAuditRoot(batchId);
  }

  async getAuditCheckpoint(batchId: number) {
    return this.auditAnchorClient.getAuditCheckpoint(batchId);
  }

  async getAuditCheckpointsRange(fromBatchId: number, toBatchId: number) {
    return this.auditAnchorClient.getAuditCheckpointsRange(fromBatchId, toBatchId);
  }

  async getAllCheckpoints() {
    return this.auditAnchorClient.getAllCheckpoints();
  }

  async getLatestAuditBatchId(forceRefresh = false): Promise<number | null> {
    return this.auditAnchorClient.getLatestAuditBatchId(forceRefresh);
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