import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { ethers } from 'ethers';

/**
 * Pure wallet helpers, extracted verbatim from the former AuthService
 * (normalizeWalletAddress, buildWalletMessage, and the ethers signature
 * verification inside consumeWalletChallenge).
 */

export function normalizeWalletAddress(address: string): string {
  try {
    return ethers.getAddress(address);
  } catch {
    throw new BadRequestException('Invalid wallet address');
  }
}

export function buildWalletMessage(
  purpose: string,
  walletAddress: string,
  nonce: string,
  expiresAt: Date,
  userId?: string,
): string {
  const lines = [
    `${process.env.AUTH_MESSAGE_DOMAIN || 'KLTN Admin Auth'} admin authentication`,
    `Purpose: ${purpose}`,
    `Wallet: ${walletAddress}`,
  ];

  if (userId) {
    lines.push(`Admin User ID: ${userId}`);
  }

  lines.push(`Nonce: ${nonce}`, `Expires At: ${expiresAt.toISOString()}`);
  return lines.join('\n');
}

/** Verify an EIP-191 personal_sign signature, returning true iff it recovers to walletAddress. */
export function verifyWalletSignature(message: string, signature: string, walletAddress: string): void {
  let recovered: string;
  try {
    recovered = ethers.verifyMessage(message, signature);
  } catch {
    throw new UnauthorizedException('Invalid wallet signature');
  }

  if (ethers.getAddress(recovered) !== walletAddress) {
    throw new UnauthorizedException('Invalid wallet signature');
  }
}
