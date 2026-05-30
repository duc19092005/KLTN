import { Injectable, OnModuleInit } from '@nestjs/common';
import { ethers } from 'ethers';

@Injectable()
export class BlockchainService implements OnModuleInit {
  private writeMutex: Promise<any> = Promise.resolve();

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
  private superAdminSigner: ethers.Wallet | null = null;

  // DepartmentRegistry: on-chain key-value store of department integrity hashes.
  private departmentRegistry: ethers.Contract | null = null;
  private departmentRegistryAddress = '';

  // FaceRegistry: on-chain key-value store of face-template integrity hashes.
  private faceRegistry: ethers.Contract | null = null;
  private faceRegistryAddress = '';

  // StaffRegistry: on-chain key-value store of staff + doctor integrity hashes.
  private staffRegistry: ethers.Contract | null = null;
  private staffRegistryAddress = '';

  // AIModelRegistry: on-chain key-value store of AI model integrity hashes.
  private aiModelRegistry: ethers.Contract | null = null;
  private aiModelRegistryAddress = '';

  private readonly abi = [
    'function authorizeAdmin(address wallet) external',
    'function revokeAdmin(address wallet) external',
    'function isAuthorized(address wallet) external view returns (bool)',
    'function owner() external view returns (address)',
    'function pendingOwner() external view returns (address)',
    'function transferOwnership(address newOwner) external',
    'function acceptOwnership() external',
    'function recordAction(bytes32 actionHash) external',
  ];

  private readonly departmentRegistryAbi = [
    'function setHash(bytes32 key, bytes32 value) external',
    'function removeHash(bytes32 key) external',
    'function getHash(bytes32 key) external view returns (bytes32)',
    'function hasHash(bytes32 key) external view returns (bool)',
    'function owner() external view returns (address)',
  ];

  private readonly faceRegistryAbi = [
    'function setFaceHash(bytes32 key, bytes32 value) external',
    'function removeFaceHash(bytes32 key) external',
    'function getFaceHash(bytes32 key) external view returns (bytes32)',
    'function hasFaceHash(bytes32 key) external view returns (bool)',
    'function owner() external view returns (address)',
  ];

  // StaffRegistry and AIModelRegistry share the same ABI shape as DepartmentRegistry.
  private readonly staffRegistryAbi = [
    'function setHash(bytes32 key, bytes32 value) external',
    'function removeHash(bytes32 key) external',
    'function getHash(bytes32 key) external view returns (bytes32)',
    'function hasHash(bytes32 key) external view returns (bool)',
    'function owner() external view returns (address)',
  ];

  private readonly aiModelRegistryAbi = [
    'function setHash(bytes32 key, bytes32 value) external',
    'function removeHash(bytes32 key) external',
    'function getHash(bytes32 key) external view returns (bytes32)',
    'function hasHash(bytes32 key) external view returns (bool)',
    'function owner() external view returns (address)',
  ];

  async onModuleInit() {
    const rpcUrl = process.env.BLOCKCHAIN_RPC_URL || 'http://127.0.0.1:8545';
    this.contractAddress = process.env.IDENTITY_REGISTRY_ADDRESS || '';
    this.provider = new ethers.JsonRpcProvider(rpcUrl);

    const superAdminKey = process.env.SUPER_ADMIN_PRIVATE_KEY;
    if (superAdminKey && superAdminKey !== 'your_super_admin_private_key_here') {
      this.superAdminSigner = new ethers.Wallet(superAdminKey, this.provider);
      console.log(`Super Admin relayer initialized: ${this.superAdminSigner.address}`);
    } else {
      console.warn('SUPER_ADMIN_PRIVATE_KEY not set. On-chain admin authorization disabled.');
    }

    if (this.contractAddress) {
      const runner = this.superAdminSigner || this.provider;
      this.contract = new ethers.Contract(this.contractAddress, this.abi, runner);
      console.log(`✅ Connected to IdentityRegistry at ${this.contractAddress}`);
    } else {
      console.warn('⚠️ IDENTITY_REGISTRY_ADDRESS not set. Blockchain checks disabled.');
    }

    this.departmentRegistryAddress = process.env.DEPARTMENT_REGISTRY_ADDRESS || '';
    if (this.departmentRegistryAddress) {
      const runner = this.superAdminSigner || this.provider;
      this.departmentRegistry = new ethers.Contract(this.departmentRegistryAddress, this.departmentRegistryAbi, runner);
      console.log(`✅ Connected to DepartmentRegistry at ${this.departmentRegistryAddress}`);
    } else {
      console.warn('⚠️ DEPARTMENT_REGISTRY_ADDRESS not set. Department on-chain anchoring disabled.');
    }

    this.faceRegistryAddress = process.env.FACE_REGISTRY_ADDRESS || '';
    if (this.faceRegistryAddress) {
      const runner = this.superAdminSigner || this.provider;
      this.faceRegistry = new ethers.Contract(this.faceRegistryAddress, this.faceRegistryAbi, runner);
      console.log(`✅ Connected to FaceRegistry at ${this.faceRegistryAddress}`);
    } else {
      console.warn('⚠️ FACE_REGISTRY_ADDRESS not set. Face integrity anchoring disabled.');
    }

    this.staffRegistryAddress = process.env.STAFF_REGISTRY_ADDRESS || '';
    if (this.staffRegistryAddress) {
      const runner = this.superAdminSigner || this.provider;
      this.staffRegistry = new ethers.Contract(this.staffRegistryAddress, this.staffRegistryAbi, runner);
      console.log(`✅ Connected to StaffRegistry at ${this.staffRegistryAddress}`);
    } else {
      console.warn('⚠️ STAFF_REGISTRY_ADDRESS not set. Staff on-chain anchoring disabled.');
    }

    this.aiModelRegistryAddress = process.env.AI_MODEL_REGISTRY_ADDRESS || '';
    if (this.aiModelRegistryAddress) {
      const runner = this.superAdminSigner || this.provider;
      this.aiModelRegistry = new ethers.Contract(this.aiModelRegistryAddress, this.aiModelRegistryAbi, runner);
      console.log(`✅ Connected to AIModelRegistry at ${this.aiModelRegistryAddress}`);
    } else {
      console.warn('⚠️ AI_MODEL_REGISTRY_ADDRESS not set. AI Model on-chain anchoring disabled.');
    }
  }

  // ---- FaceRegistry: face-template integrity anchoring ------------------------

  /** Derive the on-chain key for a user's face record from their UUID. */
  faceKey(userId: string): string {
    return ethers.keccak256(ethers.toUtf8Bytes(userId));
  }

  /** Whether the FaceRegistry contract is available for writes. */
  isFaceRegistryReady(): boolean {
    return Boolean(this.faceRegistry && this.superAdminSigner);
  }

  /**
   * Mirror a user's face-template integrity hash on-chain (on enrollment).
   * @param userId off-chain user UUID
   * @param valueBytes32 0x-prefixed 32-byte SHA256 hash of the canonical face embedding JSON
   */
  async setFaceHash(userId: string, valueBytes32: string) {
    return this.enqueueWrite(async () => {
      if (!this.faceRegistry || !this.superAdminSigner) {
        return { success: false, error: 'FaceRegistry or Super Admin signer not configured' };
      }
      try {
        const key = this.faceKey(userId);
        const writable = this.faceRegistry.connect(this.superAdminSigner) as ethers.Contract;
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
      if (!this.faceRegistry || !this.superAdminSigner) {
        return { success: false, error: 'FaceRegistry or Super Admin signer not configured' };
      }
      try {
        const key = this.faceKey(userId);
        const exists = await this.faceRegistry.hasFaceHash(key);
        if (!exists) return { success: true, alreadyAbsent: true, key };
        const writable = this.faceRegistry.connect(this.superAdminSigner) as ethers.Contract;
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

  /**
   * Derive the on-chain key for a department from its off-chain UUID.
   * keccak256(departmentId) maps an arbitrary-length id to a fixed bytes32 slot.
   */
  departmentKey(departmentId: string): string {
    return ethers.keccak256(ethers.toUtf8Bytes(departmentId));
  }

  /** Whether the DepartmentRegistry contract is available for writes. */
  isDepartmentRegistryReady(): boolean {
    return Boolean(this.departmentRegistry && this.superAdminSigner);
  }

  /**
   * Mirror a department's integrity hash on-chain.
   * @param departmentId off-chain UUID
   * @param valueBytes32 0x-prefixed 32-byte SHA256 hash of the salted canonical data
   */
  async setDepartmentHash(departmentId: string, valueBytes32: string) {
    return this.enqueueWrite(async () => {
      if (!this.departmentRegistry || !this.superAdminSigner) {
        return { success: false, error: 'DepartmentRegistry or Super Admin signer not configured' };
      }
      try {
        const key = this.departmentKey(departmentId);
        const writable = this.departmentRegistry.connect(this.superAdminSigner) as ethers.Contract;
        const tx = await writable.setHash(key, valueBytes32);
        const receipt = await tx.wait();
        return { success: true, key, txHash: tx.hash, blockNumber: receipt.blockNumber };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Failed to set department hash' };
      }
    });
  }

  /** Remove a department's hash on-chain (used on delete). */
  async removeDepartmentHash(departmentId: string) {
    return this.enqueueWrite(async () => {
      if (!this.departmentRegistry || !this.superAdminSigner) {
        return { success: false, error: 'DepartmentRegistry or Super Admin signer not configured' };
      }
      try {
        const key = this.departmentKey(departmentId);
        // Tolerate removing a key that was never anchored (e.g. created before the feature).
        const exists = await this.departmentRegistry.hasHash(key);
        if (!exists) return { success: true, alreadyAbsent: true, key };
        const writable = this.departmentRegistry.connect(this.superAdminSigner) as ethers.Contract;
        const tx = await writable.removeHash(key);
        const receipt = await tx.wait();
        return { success: true, key, txHash: tx.hash, blockNumber: receipt.blockNumber };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Failed to remove department hash' };
      }
    });
  }

  /**
   * Read the on-chain hash for a department. Returns null if the registry is unavailable
   * or no hash is set (so verification can flag a missing anchor).
   */
  async getDepartmentHash(departmentId: string): Promise<string | null> {
    if (!this.departmentRegistry) return null;
    try {
      const key = this.departmentKey(departmentId);
      const value: string = await this.departmentRegistry.getHash(key);
      if (!value || value === ethers.ZeroHash) return null;
      return value;
    } catch {
      return null;
    }
  }

  // ---- StaffRegistry: staff + doctor integrity anchoring ----------------------

  /** Derive the on-chain key for a staff/doctor record from its UUID. */
  staffKey(entityId: string): string {
    return ethers.keccak256(ethers.toUtf8Bytes(entityId));
  }

  /** Whether the StaffRegistry contract is available for writes. */
  isStaffRegistryReady(): boolean {
    return Boolean(this.staffRegistry && this.superAdminSigner);
  }

  /**
   * Mirror a staff/doctor integrity hash on-chain.
   * @param entityId off-chain UUID (staffProfileId or doctorProfileId)
   * @param valueBytes32 0x-prefixed 32-byte SHA256 hash
   */
  async setStaffHash(entityId: string, valueBytes32: string) {
    return this.enqueueWrite(async () => {
      if (!this.staffRegistry || !this.superAdminSigner) {
        return { success: false, error: 'StaffRegistry or Super Admin signer not configured' };
      }
      try {
        const key = this.staffKey(entityId);
        const writable = this.staffRegistry.connect(this.superAdminSigner) as ethers.Contract;
        const tx = await writable.setHash(key, valueBytes32);
        const receipt = await tx.wait();
        return { success: true, key, txHash: tx.hash, blockNumber: receipt.blockNumber };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Failed to set staff hash' };
      }
    });
  }

  /** Remove a staff/doctor hash on-chain. */
  async removeStaffHash(entityId: string) {
    return this.enqueueWrite(async () => {
      if (!this.staffRegistry || !this.superAdminSigner) {
        return { success: false, error: 'StaffRegistry or Super Admin signer not configured' };
      }
      try {
        const key = this.staffKey(entityId);
        const exists = await this.staffRegistry.hasHash(key);
        if (!exists) return { success: true, alreadyAbsent: true, key };
        const writable = this.staffRegistry.connect(this.superAdminSigner) as ethers.Contract;
        const tx = await writable.removeHash(key);
        const receipt = await tx.wait();
        return { success: true, key, txHash: tx.hash, blockNumber: receipt.blockNumber };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Failed to remove staff hash' };
      }
    });
  }

  /** Read the on-chain hash for a staff/doctor record. */
  async getStaffHash(entityId: string): Promise<string | null> {
    if (!this.staffRegistry) return null;
    try {
      const key = this.staffKey(entityId);
      const value: string = await this.staffRegistry.getHash(key);
      if (!value || value === ethers.ZeroHash) return null;
      return value;
    } catch {
      return null;
    }
  }

  // ---- AIModelRegistry: AI model integrity anchoring --------------------------

  /** Derive the on-chain key for an AI model record from its UUID. */
  aiModelKey(modelId: string): string {
    return ethers.keccak256(ethers.toUtf8Bytes(modelId));
  }

  /** Whether the AIModelRegistry contract is available for writes. */
  isAiModelRegistryReady(): boolean {
    return Boolean(this.aiModelRegistry && this.superAdminSigner);
  }

  /**
   * Mirror an AI model's integrity hash on-chain.
   * @param modelId off-chain UUID
   * @param valueBytes32 0x-prefixed 32-byte SHA256 hash
   */
  async setAiModelHash(modelId: string, valueBytes32: string) {
    return this.enqueueWrite(async () => {
      if (!this.aiModelRegistry || !this.superAdminSigner) {
        return { success: false, error: 'AIModelRegistry or Super Admin signer not configured' };
      }
      try {
        const key = this.aiModelKey(modelId);
        const writable = this.aiModelRegistry.connect(this.superAdminSigner) as ethers.Contract;
        const tx = await writable.setHash(key, valueBytes32);
        const receipt = await tx.wait();
        return { success: true, key, txHash: tx.hash, blockNumber: receipt.blockNumber };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Failed to set AI model hash' };
      }
    });
  }

  /** Remove an AI model's hash on-chain. */
  async removeAiModelHash(modelId: string) {
    return this.enqueueWrite(async () => {
      if (!this.aiModelRegistry || !this.superAdminSigner) {
        return { success: false, error: 'AIModelRegistry or Super Admin signer not configured' };
      }
      try {
        const key = this.aiModelKey(modelId);
        const exists = await this.aiModelRegistry.hasHash(key);
        if (!exists) return { success: true, alreadyAbsent: true, key };
        const writable = this.aiModelRegistry.connect(this.superAdminSigner) as ethers.Contract;
        const tx = await writable.removeHash(key);
        const receipt = await tx.wait();
        return { success: true, key, txHash: tx.hash, blockNumber: receipt.blockNumber };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Failed to remove AI model hash' };
      }
    });
  }

  /** Read the on-chain hash for an AI model record. */
  async getAiModelHash(modelId: string): Promise<string | null> {
    if (!this.aiModelRegistry) return null;
    try {
      const key = this.aiModelKey(modelId);
      const value: string = await this.aiModelRegistry.getHash(key);
      if (!value || value === ethers.ZeroHash) return null;
      return value;
    } catch {
      return null;
    }
  }

  async isAuthorized(walletAddress: string): Promise<boolean> {
    if (!this.contract) return false;
    try {
      return await this.contract.isAuthorized(ethers.getAddress(walletAddress));
    } catch {
      return false;
    }
  }

  async authorizeAdmin(walletAddress: string) {
    return this.enqueueWrite(async () => {
      if (!this.contract || !this.superAdminSigner) {
        return { success: false, error: 'IdentityRegistry or Super Admin signer not configured' };
      }
      try {
        const normalizedWalletAddress = ethers.getAddress(walletAddress);
        if (await this.isAuthorized(normalizedWalletAddress)) {
          return { success: true, alreadyAuthorized: true };
        }
        const writableContract = this.contract.connect(this.superAdminSigner) as ethers.Contract;
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
      if (!this.contract || !this.superAdminSigner) {
        return { success: false, error: 'IdentityRegistry or Super Admin signer not configured' };
      }
      try {
        const normalizedWalletAddress = ethers.getAddress(walletAddress);
        if (!(await this.isAuthorized(normalizedWalletAddress))) {
          return { success: true, alreadyRevoked: true };
        }
        const writableContract = this.contract.connect(this.superAdminSigner) as ethers.Contract;
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
      if (!this.contract || !this.superAdminSigner) {
        return { success: false, error: 'IdentityRegistry or Super Admin signer not configured' };
      }
      try {
        const canonicalPayload = JSON.stringify(actionPayload);
        const actionHash = ethers.keccak256(ethers.toUtf8Bytes(canonicalPayload));
        const writableContract = this.contract.connect(this.superAdminSigner) as ethers.Contract;
        const tx = await writableContract.recordAction(actionHash);
        const receipt = await tx.wait();
        return {
          success: true,
          signer: this.superAdminSigner.address,
          actionHash,
          txHash: tx.hash,
          blockNumber: receipt.blockNumber,
        };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Failed to record backend-signed action' };
      }
    });
  }

  getContractAddress(): string {
    return this.contractAddress;
  }

  getSuperAdminAddress(): string | null {
    return this.superAdminSigner?.address || null;
  }
}
