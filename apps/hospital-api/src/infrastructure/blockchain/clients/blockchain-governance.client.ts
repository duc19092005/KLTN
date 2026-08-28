import { ethers } from 'ethers';
import { computeBackendActionHash } from '../blockchain-action-hash.util';

export class BlockchainGovernanceClient {
  constructor(
    private readonly getContract: () => ethers.Contract | null,
    private readonly getOwnerSigner: () => ethers.Wallet | null,
    private readonly getRelayerSigner: () => ethers.Wallet | null,
    private readonly enqueueWrite: <T>(fn: () => Promise<T>) => Promise<T>,
  ) {}

  async isAuthorizedAdmin(walletAddress: string): Promise<boolean> {
    const contract = this.getContract();
    if (!contract) return false;
    try {
      return await contract.isAuthorized(walletAddress);
    } catch {
      return false;
    }
  }

  async isRelayer(walletAddress: string): Promise<boolean> {
    const contract = this.getContract();
    if (!contract) return false;
    try {
      return await contract.isRelayer(walletAddress);
    } catch {
      return false;
    }
  }

  async isRelayerOrOwner(walletAddress: string): Promise<boolean> {
    const contract = this.getContract();
    if (!contract) return false;
    try {
      return await contract.isRelayerOrOwner(walletAddress);
    } catch {
      return false;
    }
  }

  async authorizeAdminOnChain(walletAddress: string): Promise<string> {
    const contract = this.getContract();
    if (!contract) throw new Error('Blockchain contract not initialized.');

    return this.enqueueWrite(async () => {
      const isAuth = await contract.isAuthorized(walletAddress);
      if (isAuth) return 'ALREADY_AUTHORIZED';

      const signer = this.getRelayerSigner() || this.getOwnerSigner();
      if (!signer) throw new Error('No operational signer configured for governance call.');

      const signedContract = contract.connect(signer) as ethers.Contract;
      const tx = await signedContract.getFunction('authorizeAdmin')(walletAddress);
      const receipt = await tx.wait();
      return receipt.hash;
    });
  }

  async revokeAdminOnChain(walletAddress: string): Promise<string> {
    const contract = this.getContract();
    if (!contract) throw new Error('Blockchain contract not initialized.');
    const ownerSigner = this.getOwnerSigner();
    if (!ownerSigner) throw new Error('REVOKE_REQUIRES_OWNER: Only BLOCKCHAIN_OWNER_PRIVATE_KEY can revoke admins.');

    return this.enqueueWrite(async () => {
      const isAuth = await contract.isAuthorized(walletAddress);
      if (!isAuth) return 'ALREADY_REVOKED';

      const signedContract = contract.connect(ownerSigner) as ethers.Contract;
      const tx = await signedContract.getFunction('revokeAdmin')(walletAddress);
      const receipt = await tx.wait();
      return receipt.hash;
    });
  }

  async rotateAdminOnChain(oldWallet: string, newWallet: string): Promise<string> {
    const contract = this.getContract();
    if (!contract) throw new Error('Blockchain contract not initialized.');

    return this.enqueueWrite(async () => {
      const isOldAuth = await contract.isAuthorized(oldWallet);
      if (!isOldAuth) throw new Error(`Old wallet ${oldWallet} is not an authorized admin.`);

      const isNewAuth = await contract.isAuthorized(newWallet);
      if (isNewAuth && oldWallet.toLowerCase() !== newWallet.toLowerCase()) {
        throw new Error(`New wallet ${newWallet} is already an authorized admin.`);
      }

      const signer = this.getRelayerSigner() || this.getOwnerSigner();
      if (!signer) throw new Error('No operational signer configured for admin rotation.');

      const signedContract = contract.connect(signer) as ethers.Contract;
      const tx = await signedContract.getFunction('rotateAdmin')(oldWallet, newWallet);
      const receipt = await tx.wait();
      return receipt.hash;
    });
  }

  async recordActionOnChain(entityId: string, action: string, actorId: string): Promise<string | null> {
    const contract = this.getContract();
    if (!contract) return null;
    const signer = this.getRelayerSigner() || this.getOwnerSigner();
    if (!signer) return null;

    try {
      const actionHash = computeBackendActionHash({ entityId, action, actorId });
      return await this.enqueueWrite(async () => {
        const signedContract = contract.connect(signer) as ethers.Contract;
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
    const contract = this.getContract();
    if (!contract) throw new Error('Blockchain contract not initialized.');
    const ownerSigner = this.getOwnerSigner();
    if (!ownerSigner) throw new Error('Only BLOCKCHAIN_OWNER_PRIVATE_KEY can authorize relayers.');

    return this.enqueueWrite(async () => {
      const signedContract = contract.connect(ownerSigner) as ethers.Contract;
      const tx = await signedContract.getFunction('addRelayer')(walletAddress);
      const receipt = await tx.wait();
      return receipt.hash;
    });
  }

  async removeRelayerOnChain(walletAddress: string): Promise<string> {
    const contract = this.getContract();
    if (!contract) throw new Error('Blockchain contract not initialized.');
    const ownerSigner = this.getOwnerSigner();
    if (!ownerSigner) throw new Error('Only BLOCKCHAIN_OWNER_PRIVATE_KEY can revoke relayers.');

    return this.enqueueWrite(async () => {
      const signedContract = contract.connect(ownerSigner) as ethers.Contract;
      const tx = await signedContract.getFunction('removeRelayer')(walletAddress);
      const receipt = await tx.wait();
      return receipt.hash;
    });
  }
}