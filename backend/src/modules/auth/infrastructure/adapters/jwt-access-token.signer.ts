import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { User } from '@prisma/client';
import { AccessTokenSignerPort, SignTokenOptions } from '../../application/ports/access-token-signer.port';

/**
 * JWT adapter for the access-token signer port. Claim shape copied verbatim
 * from the former AuthService.signAccessToken(); verifySub mirrors logoutToken's
 * tolerant verify.
 */
@Injectable()
export class JwtAccessTokenSigner implements AccessTokenSignerPort {
  constructor(private readonly jwtService: JwtService) {}

  sign(
    user: Pick<User, 'id' | 'username' | 'role' | 'firstLogin' | 'tokenVersion'>,
    options: SignTokenOptions,
  ): string {
    return this.jwtService.sign({
      sub: user.id,
      username: user.username,
      role: user.role,
      verified: options.verified,
      isFirstLogin: options.isFirstLogin ?? user.firstLogin,
      walletAddress: options.walletAddress || undefined,
      tokenVersion: user.tokenVersion,
    });
  }

  verifySub(token: string): string | null {
    try {
      const payload = this.jwtService.verify<{ sub?: string }>(token);
      return payload.sub ?? null;
    } catch {
      // Expired or malformed tokens still get cleared from the browser by the controller.
      return null;
    }
  }
}
