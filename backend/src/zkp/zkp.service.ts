import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as crypto from 'crypto';
import * as CryptoJS from 'crypto-js';

@Injectable()
export class ZkpService {
  private readonly encryptionKey: string;

  constructor(private prisma: PrismaService) {
    this.encryptionKey = process.env.ENCRYPTION_KEY || 'default_encryption_key_32bytes!!';
  }

  /**
   * Generate a random secret for ZKP identity commitment
   * The secret is a random BigInt within the BN254 scalar field
   */
  generateSecret(): string {
    const bn254Prime = BigInt('21888242871839275222246405745257275088548364400416034343698204186575808495617');
    const randomBytes = crypto.randomBytes(32);
    const secret = BigInt('0x' + randomBytes.toString('hex')) % bn254Prime;
    return secret.toString();
  }

  /**
   * Compute Poseidon commitment: Poseidon(secret, faceHash)
   * For prototype, we use SHA-256 based simulation
   * In production, use circomlibjs Poseidon
   */
  async computeCommitment(secret: string, faceHash: string): Promise<string> {
    try {
      // Try using circomlibjs Poseidon (production)
      const { buildPoseidon } = await import('circomlibjs');
      const poseidon = await buildPoseidon();
      const hash = poseidon([BigInt(secret), BigInt(faceHash)]);
      return poseidon.F.toString(hash);
    } catch (err) {
      // Fallback: SHA-256 based hash (development)
      console.warn('circomlibjs not available, using SHA-256 fallback for commitment');
      const bn254Prime = BigInt('21888242871839275222246405745257275088548364400416034343698204186575808495617');
      const combined = `${secret}:${faceHash}`;
      const hash = crypto.createHash('sha256').update(combined).digest('hex');
      return (BigInt('0x' + hash) % bn254Prime).toString();
    }
  }

  /**
   * Encrypt secret with AES-256 for secure storage
   */
  encryptSecret(secret: string): string {
    return CryptoJS.AES.encrypt(secret, this.encryptionKey).toString();
  }

  /**
   * Decrypt stored secret
   */
  decryptSecret(encryptedSecret: string): string {
    const bytes = CryptoJS.AES.decrypt(encryptedSecret, this.encryptionKey);
    return bytes.toString(CryptoJS.enc.Utf8);
  }

  /**
   * Full registration flow for Admin:
   * Reuse or generate secret → compute commitment → store in AdminProfile
   * This is called during Admin first-time registration (Step 3: ZKP Identity)
   */
  async registerIdentity(userId: string, faceHash: string) {
    const adminProfile = await this.prisma.adminProfile.findUnique({
      where: { userId },
    });

    if (!adminProfile) {
      throw new Error('AdminProfile not found. Ensure user is an Admin.');
    }

    let secret: string;
    if (adminProfile.zkpSecret) {
      // Reuse secret if already generated
      try {
        secret = this.decryptSecret(adminProfile.zkpSecret);
      } catch {
        // If decryption fails, generate a new one
        secret = this.generateSecret();
        const encrypted = this.encryptSecret(secret);
        await this.prisma.adminProfile.update({
          where: { userId },
          data: { zkpSecret: encrypted },
        });
      }
    } else {
      // Generate new secret
      secret = this.generateSecret();
      const encryptedSecret = this.encryptSecret(secret);
      await this.prisma.adminProfile.update({
        where: { userId },
        data: { zkpSecret: encryptedSecret },
      });
    }

    const commitment = await this.computeCommitment(secret, faceHash);

    await this.prisma.adminProfile.update({
      where: { userId },
      data: { zkpCommitment: commitment },
    });

    return {
      // Secret is NOT returned here - it was already shown via MFA secret at setup
      commitment,
      message: 'ZKP identity registered successfully',
    };
  }

  /**
   * Finalize registration: set firstLogin to false and registrationStep to done.
   * Admin done step = 4 (face→wallet→zkp→done)
   * Doctor done step = 3 (password→face→done)
   */
  async completeRegistration(userId: string) {
    // Determine the user's role to set the correct done step
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
    const doneStep = user?.role === 'ADMIN' ? 4 : 3;

    // Invalidate invite token after registration is complete
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        firstLogin: false,
        registrationStep: doneStep,
        inviteToken: null,
        inviteTokenExpiry: null,
      },
    });
  }

  /**
   * Get commitment and faceHash for recovery proof generation (Admin only)
   */
  async getRecoveryData(userId: string) {
    const adminProfile = await this.prisma.adminProfile.findUnique({
      where: { userId },
    });

    if (!adminProfile || !adminProfile.zkpCommitment || !adminProfile.faceHash) {
      return null;
    }

    return {
      commitment: adminProfile.zkpCommitment,
      faceHash: adminProfile.faceHash,
    };
  }
}
