import { Injectable, OnModuleInit } from '@nestjs/common';
import { ethers } from 'ethers';

@Injectable()
export class BlockchainService implements OnModuleInit {
  private provider: ethers.JsonRpcProvider;
  private contract: ethers.Contract | null = null;
  private contractAddress = '';
  private superAdminSigner: ethers.Wallet | null = null;

  private readonly abi = [
    'function authorizeAdmin(address wallet) external',
    'function revokeAdmin(address wallet) external',
    'function isAuthorized(address wallet) external view returns (bool)',
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
  }

  async isAuthorized(walletAddress: string): Promise<boolean> {
    if (!this.contract) return false;
    try {
      return await this.contract.isAuthorized(walletAddress);
    } catch {
      return false;
    }
  }

  async authorizeAdmin(walletAddress: string) {
    if (!this.contract || !this.superAdminSigner) {
      return { success: false, error: 'IdentityRegistry or Super Admin signer not configured' };
    }

    const writableContract = this.contract.connect(this.superAdminSigner) as ethers.Contract;
    const tx = await writableContract.authorizeAdmin(walletAddress);
    const receipt = await tx.wait();

    return {
      success: true,
      txHash: tx.hash,
      blockNumber: receipt.blockNumber,
    };
  }

  async revokeAdmin(walletAddress: string) {
    if (!this.contract || !this.superAdminSigner) {
      return { success: false, error: 'IdentityRegistry or Super Admin signer not configured' };
    }

    const writableContract = this.contract.connect(this.superAdminSigner) as ethers.Contract;
    const tx = await writableContract.revokeAdmin(walletAddress);
    const receipt = await tx.wait();

    return {
      success: true,
      txHash: tx.hash,
      blockNumber: receipt.blockNumber,
    };
  }

  getContractAddress(): string {
    return this.contractAddress;
  }

  getSuperAdminAddress(): string | null {
    return this.superAdminSigner?.address || null;
  }
}
