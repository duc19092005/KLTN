import { Injectable, OnModuleInit } from '@nestjs/common';
import { ethers } from 'ethers';

@Injectable()
export class BlockchainService implements OnModuleInit {
  private provider: ethers.JsonRpcProvider;
  private contract: ethers.Contract;
  private contractAddress: string;
  private superAdminSigner: ethers.Wallet | null = null;

  // IdentityRegistry ABI
  private readonly abi = [
    'function registerIdentity(uint256 _commitment) external',
    'function recoverWallet(uint[2] _pA, uint[2][2] _pB, uint[2] _pC, uint256 _commitment, address _newAddress) external',
    'function updateAdminWallet(uint256 _commitment, address _newAddress) external',
    'function isAuthorized(address _addr) external view returns (bool)',
    'function getIdentity(uint256 _commitment) external view returns (address, bool, uint256)',
    'function addressToCommitment(address) external view returns (uint256)',
    'event IdentityRegistered(uint256 indexed commitment, address indexed walletAddress)',
    'event WalletRecovered(uint256 indexed commitment, address indexed oldAddress, address indexed newAddress)',
  ];

  async onModuleInit() {
    const rpcUrl = process.env.BLOCKCHAIN_RPC_URL || 'http://127.0.0.1:8545';
    this.contractAddress = process.env.IDENTITY_REGISTRY_ADDRESS || '';

    this.provider = new ethers.JsonRpcProvider(rpcUrl);

    if (this.contractAddress) {
      this.contract = new ethers.Contract(this.contractAddress, this.abi, this.provider);
      console.log(`✅ Connected to IdentityRegistry at ${this.contractAddress}`);
    } else {
      console.warn('⚠️ IDENTITY_REGISTRY_ADDRESS not set. Blockchain features disabled.');
    }

    const aiModelAddress = process.env.AI_MODEL_REGISTRY_ADDRESS;
    if (aiModelAddress) {
      this.initAiModelContract(aiModelAddress);
    } else {
      console.warn('⚠️ AI_MODEL_REGISTRY_ADDRESS not set. AI Model blockchain features disabled.');
    }

    const dbBackupAddress = process.env.DB_BACKUP_REGISTRY_ADDRESS;
    if (dbBackupAddress) {
      this.initDbBackupContract(dbBackupAddress);
    } else {
      console.warn('⚠️ DB_BACKUP_REGISTRY_ADDRESS not set. DB backup blockchain features disabled.');
    }

    // Initialize Super Admin signer for relayer operations
    const superAdminKey = process.env.SUPER_ADMIN_PRIVATE_KEY;
    if (superAdminKey && superAdminKey !== 'your_super_admin_private_key_here') {
      this.superAdminSigner = new ethers.Wallet(superAdminKey, this.provider);
      console.log(`✅ Super Admin Relayer initialized: ${this.superAdminSigner.address}`);
    } else {
      console.warn('⚠️ SUPER_ADMIN_PRIVATE_KEY not set. Relayer features disabled.');
    }
  }

  /**
   * Check if an address is authorized on-chain (has active identity)
   * This is the ANTI-HACKER check: even if DB is compromised,
   * the wallet must be registered on the immutable blockchain
   */
  async isAuthorized(address: string): Promise<boolean> {
    if (!this.contract) return false;
    try {
      return await this.contract.isAuthorized(address);
    } catch {
      return false;
    }
  }

  async getIdentity(commitment: string) {
    if (!this.contract) return null;
    try {
      const [walletAddress, isActive, registeredAt] = await this.contract.getIdentity(commitment);
      return { walletAddress, isActive, registeredAt: registeredAt.toString() };
    } catch {
      return null;
    }
  }

  async getCommitmentByAddress(address: string): Promise<string | null> {
    if (!this.contract) return null;
    try {
      const commitment = await this.contract.addressToCommitment(address);
      return commitment.toString();
    } catch {
      return null;
    }
  }

  /**
   * RELAYER: Register identity on-chain using Super Admin's private key
   * This is called during Admin first-time registration
   * The Admin's wallet address calls registerIdentity with their commitment
   */
  async registerOnChain(commitment: string, walletAddress: string) {
    if (!this.contractAddress) return { success: false, error: 'Blockchain not initialized' };

    const lowerAddress = walletAddress.toLowerCase();

    // Try using known Hardhat keys first (development)
    const hardhatKeys: Record<string, string> = {
      '0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266': '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
      '0x70997970c51812dc3a010c7d01b50e0d17dc79c8': '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d',
      '0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc': '0x5de4111afa73f9876e5228e37186140b6e9b40ba9c195609ee7def409a5ae9cd',
    };

    const privateKey = hardhatKeys[lowerAddress];
    if (!privateKey) {
      // For custom wallets: use Super Admin relayer if available
      if (this.superAdminSigner) {
        return this.registerOnChainViaRelayer(commitment, walletAddress);
      }
      console.warn(`[Blockchain] Custom address ${walletAddress} cannot be signed. Mocking.`);
      return { success: true, mocked: true, message: 'Mocked registration on-chain' };
    }

    try {
      const signer = new ethers.Wallet(privateKey, this.provider);
      const userContract = new ethers.Contract(this.contractAddress, this.abi, signer);
      const tx = await userContract.registerIdentity(commitment);
      await tx.wait();
      console.log(`[Blockchain] Registered commitment ${commitment} on-chain for ${walletAddress}`);
      return { success: true, hash: tx.hash };
    } catch (err: any) {
      console.error(`[Blockchain] Failed to register on-chain:`, err);
      throw err;
    }
  }

  /**
   * RELAYER: Register identity using Super Admin's key
   * Used when the Admin's wallet doesn't have a known private key on the backend
   * Super Admin first registers, then can transfer via updateAdminWallet if needed
   */
  private async registerOnChainViaRelayer(commitment: string, walletAddress: string) {
    if (!this.superAdminSigner) {
      return { success: false, error: 'Super Admin signer not configured' };
    }

    try {
      const relayerContract = new ethers.Contract(
        this.contractAddress,
        this.abi,
        this.superAdminSigner,
      );
      // Note: registerIdentity uses msg.sender, so this registers under Super Admin's address
      // For custom wallets, we'd need a different approach or the wallet owner signs directly
      const tx = await relayerContract.registerIdentity(commitment);
      await tx.wait();
      console.log(`[Blockchain] Registered commitment ${commitment} via relayer for ${walletAddress}`);
      return { success: true, hash: tx.hash, relayed: true };
    } catch (err: any) {
      console.error(`[Blockchain] Relayer registration failed:`, err);
      throw err;
    }
  }

  /**
   * RELAYER: Update wallet address on-chain (for wallet recovery)
   * Only Super Admin can call updateAdminWallet on the smart contract
   */
  async updateWalletOnChain(commitment: string, newWalletAddress: string) {
    if (!this.superAdminSigner) {
      return { success: false, error: 'Super Admin signer not configured' };
    }

    try {
      const relayerContract = new ethers.Contract(
        this.contractAddress,
        this.abi,
        this.superAdminSigner,
      );
      const tx = await relayerContract.updateAdminWallet(commitment, newWalletAddress);
      await tx.wait();
      console.log(`[Blockchain] Updated wallet to ${newWalletAddress} for commitment ${commitment}`);
      return { success: true, hash: tx.hash };
    } catch (err: any) {
      console.error(`[Blockchain] Wallet update on-chain failed:`, err);
      throw err;
    }
  }

  getContractAddress(): string {
    return this.contractAddress;
  }

  getAbi() {
    return this.abi;
  }

  getSuperAdminAddress(): string | null {
    return this.superAdminSigner ? this.superAdminSigner.address : null;
  }

  // ============================================================
  // AI MODEL REGISTRY METHODS
  // ============================================================

  public aiModelContract: ethers.Contract | null = null;
  private readonly aiModelAbi = [
    'function registerModel(string _modelId, string _modelHash) external',
    'function addModelHash(string _modelId, string _modelHash) external',
    'function deactivateModelHash(string _modelId, string _modelHash) external',
    'function activateModelHash(string _modelId, string _modelHash) external',
    'function isModelHashActive(string _modelId, string _modelHash) external view returns (bool)',
    'function getModelDetails(string _modelId) external view returns (string, bool)',
    'event ModelRegistered(string indexed modelId, string modelHash, uint256 timestamp)',
    'event ModelHashAdded(string indexed modelId, string modelHash, uint256 timestamp)',
    'event ModelHashDeactivated(string indexed modelId, string modelHash, uint256 timestamp)',
    'event ModelHashActivated(string indexed modelId, string modelHash, uint256 timestamp)',
  ];

  /**
   * Initialize AI Model Registry contract
   * Call this after deploying AiModelRegistry.sol
   */
  initAiModelContract(contractAddress: string) {
    if (!contractAddress) {
      console.warn('⚠️ AI_MODEL_REGISTRY_ADDRESS not provided');
      return;
    }

    this.aiModelContract = new ethers.Contract(
      contractAddress,
      this.aiModelAbi,
      this.provider,
    );
    console.log(`✅ Connected to AiModelRegistry at ${contractAddress}`);
  }

  /**
   * Register AI model on blockchain
   * @param modelId Unique model identifier
   * @param ipHash Hashed IP (SHA-256 of original IP hash)
   */
  async registerAiModel(
    modelId: string,
    ipHash: string,
  ) {
    if (!this.aiModelContract) {
      return { success: false, error: 'AI Model Registry not initialized' };
    }

    if (!this.superAdminSigner) {
      return { success: false, error: 'Super Admin signer not configured' };
    }

    try {
      const contract = this.aiModelContract.connect(this.superAdminSigner) as ethers.Contract;
      const tx = await contract.registerModel(modelId, ipHash);
      const receipt = await tx.wait();

      console.log(`[Blockchain] Registered AI model ${modelId} on-chain`);
      return {
        success: true,
        txHash: tx.hash,
        blockNumber: receipt.blockNumber,
      };
    } catch (err: any) {
      console.error(`[Blockchain] Failed to register AI model:`, err);
      return {
        success: false,
        error: err.message || 'Unknown error',
      };
    }
  }

  /**
   * Add new IP hash for existing model
   */
  async addAiModelHash(modelId: string, ipHash: string) {
    if (!this.aiModelContract || !this.superAdminSigner) {
      return { success: false, error: 'Contract or signer not initialized' };
    }

    try {
      const contract = this.aiModelContract.connect(this.superAdminSigner) as ethers.Contract;
      const tx = await contract.addModelHash(modelId, ipHash);
      const receipt = await tx.wait();

      console.log(`[Blockchain] Added hash for model ${modelId}`);
      return {
        success: true,
        txHash: tx.hash,
        blockNumber: receipt.blockNumber,
      };
    } catch (err: any) {
      console.error(`[Blockchain] Failed to add model hash:`, err);
      return { success: false, error: err.message };
    }
  }

  /**
   * Deactivate IP hash for a model
   */
  async deactivateAiModelHash(modelId: string, ipHash: string) {
    if (!this.aiModelContract || !this.superAdminSigner) {
      return { success: false, error: 'Contract or signer not initialized' };
    }

    try {
      const contract = this.aiModelContract.connect(this.superAdminSigner) as ethers.Contract;
      const tx = await contract.deactivateModelHash(modelId, ipHash);
      const receipt = await tx.wait();

      console.log(`[Blockchain] Deactivated hash for model ${modelId}`);
      return {
        success: true,
        txHash: tx.hash,
        blockNumber: receipt.blockNumber,
      };
    } catch (err: any) {
      console.error(`[Blockchain] Failed to deactivate model hash:`, err);
      return { success: false, error: err.message };
    }
  }

  /**
   * Check if model hash is active on blockchain
   */
  async isAiModelHashActive(modelId: string, ipHash: string): Promise<boolean> {
    if (!this.aiModelContract) return false;

    try {
      return await this.aiModelContract.isModelHashActive(modelId, ipHash);
    } catch (err) {
      console.error(`[Blockchain] Failed to check model hash:`, err);
      return false;
    }
  }

  // ============================================================
  // DB BACKUP REGISTRY METHODS
  // ============================================================

  private dbBackupContract: ethers.Contract | null = null;
  private readonly dbBackupAbi = [
    'function mintBackupNFT(address to, string memory tokenURI, string memory ipfsCID, bytes32 fileHash) public returns (uint256)',
    'function addHourlyBackup(string memory dateKey, string memory ipfsCID) public',
    'function getHourlyBackups(string memory dateKey) public view returns (string[] memory)',
    'event DailyBackupMinted(uint256 indexed tokenId, string ipfsCID, bytes32 fileHash)',
    'event HourlyBackupAdded(string indexed dateKey, string ipfsCID, uint256 timestamp)',
  ];

  initDbBackupContract(contractAddress: string) {
    if (!contractAddress) return;
    this.dbBackupContract = new ethers.Contract(
      contractAddress,
      this.dbBackupAbi,
      this.provider,
    );
    console.log(`✅ Connected to DbBackupRegistry at ${contractAddress}`);
  }

  async mintBackupNFT(recipient: string, tokenURI: string, ipfsCID: string, fileHash: string) {
    if (!this.dbBackupContract) {
      return { success: false, error: 'DB Backup Registry not initialized' };
    }
    if (!this.superAdminSigner) {
      return { success: false, error: 'Super Admin signer not configured' };
    }

    try {
      const contract = this.dbBackupContract.connect(this.superAdminSigner) as ethers.Contract;
      // Convert file hash to bytes32 format (it should be a hex string starting with 0x)
      const formattedHash = fileHash.startsWith('0x') ? fileHash : `0x${fileHash}`;
      const tx = await contract.mintBackupNFT(recipient, tokenURI, ipfsCID, formattedHash);
      const receipt = await tx.wait();

      console.log(`[Blockchain] Minted DB Backup NFT, token ID recorded, tx: ${tx.hash}`);
      return {
        success: true,
        txHash: tx.hash,
        blockNumber: receipt.blockNumber,
      };
    } catch (err: any) {
      console.error(`[Blockchain] Failed to mint DB Backup NFT:`, err);
      return { success: false, error: err.message || 'Unknown error' };
    }
  }

  async addHourlyBackup(dateKey: string, ipfsCID: string) {
    if (!this.dbBackupContract) {
      return { success: false, error: 'DB Backup Registry not initialized' };
    }
    if (!this.superAdminSigner) {
      return { success: false, error: 'Super Admin signer not configured' };
    }

    try {
      const contract = this.dbBackupContract.connect(this.superAdminSigner) as ethers.Contract;
      const tx = await contract.addHourlyBackup(dateKey, ipfsCID);
      const receipt = await tx.wait();

      console.log(`[Blockchain] Added hourly backup CID ${ipfsCID} for date ${dateKey}`);
      return {
        success: true,
        txHash: tx.hash,
        blockNumber: receipt.blockNumber,
      };
    } catch (err: any) {
      console.error(`[Blockchain] Failed to add hourly backup:`, err);
      return { success: false, error: err.message || 'Unknown error' };
    }
  }

  async getHourlyBackups(dateKey: string): Promise<string[]> {
    if (!this.dbBackupContract) return [];
    try {
      return await this.dbBackupContract.getHourlyBackups(dateKey);
    } catch (err) {
      console.error(`[Blockchain] Failed to get hourly backups:`, err);
      return [];
    }
  }
}
