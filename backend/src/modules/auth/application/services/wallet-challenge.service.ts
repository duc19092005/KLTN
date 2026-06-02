import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { AdminProfile } from '@prisma/client';
import * as crypto from 'crypto';
import { AUTH_REPOSITORY, AuthRepositoryPort } from '../ports/auth.repository.port';
import { WALLET_NONCE_TTL_MS } from '../../domain/auth.constants';
import { buildWalletMessage, verifyWalletSignature } from '../../domain/wallet.util';

/**
 * Shared wallet challenge create/consume, extracted verbatim from the former
 * AuthService.createWalletChallenge() and consumeWalletChallenge(). Preserves
 * the message format, the EIP-191 signature check, and the atomic single-use
 * nonce consume (updateMany count must be 1).
 */
@Injectable()
export class WalletChallengeService {
  constructor(@Inject(AUTH_REPOSITORY) private readonly repo: AuthRepositoryPort) {}

  async create(adminProfileId: string, walletAddress: string, purpose: string, userId?: string) {
    const nonce = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + WALLET_NONCE_TTL_MS);
    const message = buildWalletMessage(purpose, walletAddress, nonce, expiresAt, userId);

    await this.repo.setWalletNonce(adminProfileId, nonce, purpose, expiresAt);

    return {
      walletAddress,
      nonce,
      expiresAt: expiresAt.toISOString(),
      message,
    };
  }

  async consume(
    adminProfile: AdminProfile,
    walletAddress: string,
    signature: string,
    message: string,
    purpose: string,
    userId?: string,
  ) {
    const now = new Date();
    if (
      !adminProfile.nonce ||
      !adminProfile.nonceExpiresAt ||
      adminProfile.nonceExpiresAt < now ||
      adminProfile.noncePurpose !== purpose
    ) {
      throw new UnauthorizedException('Invalid or expired wallet challenge');
    }

    const expectedMessage = buildWalletMessage(
      purpose,
      walletAddress,
      adminProfile.nonce,
      adminProfile.nonceExpiresAt,
      userId,
    );
    if (message !== expectedMessage) {
      throw new UnauthorizedException('Invalid wallet challenge message');
    }

    verifyWalletSignature(message, signature, walletAddress);

    const count = await this.repo.consumeWalletNonce(adminProfile.id, adminProfile.nonce, purpose, now);
    if (count !== 1) {
      throw new UnauthorizedException('Wallet challenge has already been used');
    }
  }
}
