import { ethers } from 'ethers';

export class BlockchainFaceRegistryClient {
  constructor(
    private readonly getFaceRegistry: () => ethers.Contract | null,
    private readonly getOwnerSigner: () => ethers.Wallet | null,
    private readonly getRelayerSigner: () => ethers.Wallet | null,
    private readonly enqueueWrite: <T>(fn: () => Promise<T>) => Promise<T>,
  ) {}

  async setFaceHashOnChain(userKey: string, faceHashBytes32: string): Promise<string | null> {
    const faceRegistry = this.getFaceRegistry();
    if (!faceRegistry) return null;
    const signer = this.getRelayerSigner() || this.getOwnerSigner();
    if (!signer) return null;

    try {
      const keyBytes32 = ethers.keccak256(ethers.toUtf8Bytes(userKey));
      return await this.enqueueWrite(async () => {
        const signedRegistry = faceRegistry.connect(signer) as ethers.Contract;
        const tx = await signedRegistry.getFunction('setFaceHash')(keyBytes32, faceHashBytes32);
        const receipt = await tx.wait();
        return receipt.hash;
      });
    } catch (err) {
      console.error(`Failed to setFaceHash on-chain for ${userKey}:`, err);
      return null;
    }
  }

  async setFaceRecoveryOnChain(
    userKey: string,
    faceHashBytes32: string,
    artifactHashBytes32: string,
    artifactUri: string,
  ): Promise<{ txHash: string; keyBytes32: string } | null> {
    const faceRegistry = this.getFaceRegistry();
    if (!faceRegistry) return null;
    const signer = this.getRelayerSigner() || this.getOwnerSigner();
    if (!signer) return null;

    try {
      const keyBytes32 = ethers.keccak256(ethers.toUtf8Bytes(userKey));
      const txHash = await this.enqueueWrite(async () => {
        const signedRegistry = faceRegistry.connect(signer) as ethers.Contract;
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

  async getFaceHashFromChain(userKey: string): Promise<string | null> {
    const faceRegistry = this.getFaceRegistry();
    if (!faceRegistry) return null;
    try {
      const keyBytes32 = ethers.keccak256(ethers.toUtf8Bytes(userKey));
      const value: string = await faceRegistry.getFaceHash(keyBytes32);
      if (!value || value === ethers.ZeroHash) return null;
      return value;
    } catch {
      return null;
    }
  }

  async getFaceRecoveryFromChain(userKey: string): Promise<{
    faceHash: string;
    artifactHash: string;
    artifactUri: string;
    isActive: boolean;
    updatedAt: number;
  } | null> {
    const faceRegistry = this.getFaceRegistry();
    if (!faceRegistry) return null;
    try {
      const keyBytes32 = ethers.keccak256(ethers.toUtf8Bytes(userKey));
      const [faceHash, artifactHash, artifactUri, isActive, updatedAt] =
        await faceRegistry.getFaceRecovery(keyBytes32);
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
}