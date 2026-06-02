import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { AUTH_REPOSITORY, AuthRepositoryPort } from '../ports/auth.repository.port';
import { ACCESS_TOKEN_SIGNER, AccessTokenSignerPort } from '../ports/access-token-signer.port';
import { AUTH_CHAIN_GATEWAY, AuthChainGatewayPort } from '../ports/auth-chain-gateway.port';
import { WalletChallengeService } from '../services/wallet-challenge.service';
import { WALLET_PURPOSE_LOGIN } from '../../domain/auth.constants';
import { normalizeWalletAddress } from '../../domain/wallet.util';
import { toPublicUser } from '../../domain/public-user';

/**
 * Admin wallet login (signature step). Behavior copied verbatim from the former
 * AuthService.walletLogin(): validates setup, consumes the login challenge,
 * re-checks on-chain authorization, then issues an unverified token requiring
 * subsequent face verification.
 */
@Injectable()
export class WalletLoginUseCase {
  constructor(
    @Inject(AUTH_REPOSITORY) private readonly repo: AuthRepositoryPort,
    @Inject(ACCESS_TOKEN_SIGNER) private readonly tokenSigner: AccessTokenSignerPort,
    @Inject(AUTH_CHAIN_GATEWAY) private readonly chain: AuthChainGatewayPort,
    private readonly walletChallenge: WalletChallengeService,
  ) {}

  async execute(walletAddress: string, signature: string, message: string) {
    const normalizedWalletAddress = normalizeWalletAddress(walletAddress);
    const adminProfile = await this.repo.findAdminByWallet(normalizedWalletAddress);

    if (!adminProfile) throw new UnauthorizedException('Wallet not registered');
    if (adminProfile.user.status !== 'ACTIVE' || adminProfile.user.firstLogin) {
      throw new UnauthorizedException('Admin setup is not complete');
    }

    await this.walletChallenge.consume(adminProfile, normalizedWalletAddress, signature, message, WALLET_PURPOSE_LOGIN);

    const isOnChainAuthorized = await this.chain.isAuthorized(normalizedWalletAddress);
    if (!isOnChainAuthorized) {
      throw new UnauthorizedException('Wallet not authorized on blockchain.');
    }

    return {
      access_token: this.tokenSigner.sign(adminProfile.user, { verified: false, walletAddress: normalizedWalletAddress }),
      requireVerification: true,
      user: toPublicUser(
        { ...adminProfile.user, adminProfile: { ...adminProfile, walletAddress: normalizedWalletAddress } },
        false,
      ),
    };
  }
}
