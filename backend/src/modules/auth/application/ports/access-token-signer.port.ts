import { User } from '@prisma/client';

/** DI token for the access-token signer port. */
export const ACCESS_TOKEN_SIGNER = Symbol('ACCESS_TOKEN_SIGNER');

export type SignTokenOptions = { verified: boolean; walletAddress?: string | null; isFirstLogin?: boolean };

/**
 * Boundary for issuing/decoding the JWT access token. The adapter wraps
 * Nest's JwtService, preserving the exact claim shape from the former
 * AuthService.signAccessToken().
 */
export interface AccessTokenSignerPort {
  sign(
    user: Pick<User, 'id' | 'username' | 'role' | 'firstLogin' | 'tokenVersion'>,
    options: SignTokenOptions,
  ): string;
  /** Verify a token and return its sub (or null on failure). Used by logoutToken. */
  verifySub(token: string): string | null;
}
