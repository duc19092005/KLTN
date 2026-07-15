/** DI token for the auth chain gateway port. */
export const AUTH_CHAIN_GATEWAY = Symbol('AUTH_CHAIN_GATEWAY');

export type ChainWriteResult = { success: boolean; error?: string; txHash?: string };

/**
 * Boundary for the on-chain operations used by auth: anchoring/reading the
 * face-template integrity hash (FaceRegistry) and authorizing/checking admin
 * wallets (IdentityRegistry). Wraps BlockchainService so the auth use cases stay
 * decoupled from ethers/contract details.
 */
export interface AuthChainGatewayPort {
  setFaceHash(userId: string, faceHashBytes32: string): Promise<ChainWriteResult>;
  getFaceHash(userId: string): Promise<string | null>;
  authorizeAdmin(walletAddress: string): Promise<ChainWriteResult>;
  rotateAdmin(oldWalletAddress: string, newWalletAddress: string): Promise<ChainWriteResult>;
  isAuthorized(walletAddress: string): Promise<boolean>;
}
