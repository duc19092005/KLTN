import { Injectable } from '@nestjs/common';
import { BlockchainService } from '../../../../infrastructure/blockchain/blockchain.service';
import { AuthChainGatewayPort, ChainWriteResult } from '../../application/ports/auth-chain-gateway.port';

/**
 * Wraps BlockchainService for the on-chain operations used by auth: anchoring/
 * reading the face-template integrity hash (FaceRegistry) and authorizing/
 * checking admin wallets (IdentityRegistry). Behavior copied verbatim.
 */
@Injectable()
export class BlockchainAuthChainGateway implements AuthChainGatewayPort {
  constructor(private readonly blockchain: BlockchainService) {}

  async setFaceHash(userId: string, faceHashBytes32: string): Promise<ChainWriteResult> {
    try {
      const txHash = await this.blockchain.setFaceHash(userId, faceHashBytes32);
      return txHash ? { success: true, txHash } : { success: false, error: 'On-chain write failed.' };
    } catch (err: any) {
      return { success: false, error: err.message || 'On-chain write failed.' };
    }
  }

  async setFaceRecovery(
    userId: string,
    faceHashBytes32: string,
    artifactHashBytes32: string,
    artifactUri: string,
  ): Promise<ChainWriteResult> {
    try {
      const res = await this.blockchain.setFaceRecovery(
        userId,
        faceHashBytes32,
        artifactHashBytes32,
        artifactUri,
      );
      return res ? { success: true, txHash: res.txHash } : { success: false, error: 'On-chain recovery write failed.' };
    } catch (err: any) {
      return { success: false, error: err.message || 'On-chain recovery write failed.' };
    }
  }

  async getFaceHash(userId: string): Promise<string | null> {
    return this.blockchain.getFaceHash(userId);
  }

  async getFaceRecovery(userId: string) {
    return this.blockchain.getFaceRecovery(userId);
  }

  async authorizeAdmin(walletAddress: string): Promise<ChainWriteResult> {
    try {
      const txHash = await this.blockchain.authorizeAdmin(walletAddress);
      return txHash ? { success: true, txHash } : { success: false, error: 'Authorization failed.' };
    } catch (err: any) {
      return { success: false, error: err.message || 'Authorization failed.' };
    }
  }

  async rotateAdmin(oldWalletAddress: string, newWalletAddress: string): Promise<ChainWriteResult> {
    try {
      const txHash = await this.blockchain.rotateAdmin(oldWalletAddress, newWalletAddress);
      return txHash ? { success: true, txHash } : { success: false, error: 'Rotation failed.' };
    } catch (err: any) {
      return { success: false, error: err.message || 'Rotation failed.' };
    }
  }

  async isAuthorized(walletAddress: string): Promise<boolean> {
    return this.blockchain.isAuthorized(walletAddress);
  }
}
