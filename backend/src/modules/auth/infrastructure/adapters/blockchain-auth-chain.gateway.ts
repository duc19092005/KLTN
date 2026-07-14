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
    return this.blockchain.setFaceHash(userId, faceHashBytes32) as Promise<ChainWriteResult>;
  }

  async getFaceHash(userId: string): Promise<string | null> {
    return this.blockchain.getFaceHash(userId);
  }

  async authorizeAdmin(walletAddress: string): Promise<ChainWriteResult> {
    return this.blockchain.authorizeAdmin(walletAddress) as Promise<ChainWriteResult>;
  }

  async rotateAdmin(oldWalletAddress: string, newWalletAddress: string): Promise<ChainWriteResult> {
    return this.blockchain.rotateAdmin(oldWalletAddress, newWalletAddress) as Promise<ChainWriteResult>;
  }

  async isAuthorized(walletAddress: string): Promise<boolean> {
    return this.blockchain.isAuthorized(walletAddress);
  }
}
