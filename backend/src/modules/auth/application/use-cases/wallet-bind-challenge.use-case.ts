import { ForbiddenException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { AUTH_REPOSITORY, AuthRepositoryPort } from '../ports/auth.repository.port';
import { AuthUserLookupService } from '../services/auth-user-lookup.service';
import { WalletChallengeService } from '../services/wallet-challenge.service';
import { WALLET_PURPOSE_BIND } from '../../domain/auth.constants';
import { normalizeWalletAddress } from '../../domain/wallet.util';

/**
 * Issues a wallet-bind challenge during first admin setup. Behavior copied
 * verbatim from the former AuthService.walletBindChallenge().
 */
@Injectable()
export class WalletBindChallengeUseCase {
  constructor(
    @Inject(AUTH_REPOSITORY) private readonly repo: AuthRepositoryPort,
    private readonly lookup: AuthUserLookupService,
    private readonly walletChallenge: WalletChallengeService,
  ) {}

  async execute(userId: string, address: string) {
    const walletAddress = normalizeWalletAddress(address);
    const user = await this.lookup.getAdminUser(userId);

    if (!user.firstLogin) {
      throw new ForbiddenException('Wallet binding is only available during first admin setup');
    }
    if (!user.faceEmbedding) {
      throw new UnauthorizedException('Please register face before binding wallet');
    }
    if (
      user.adminProfile!.walletAddress &&
      user.adminProfile!.walletAddress.toLowerCase() !== walletAddress.toLowerCase()
    ) {
      throw new UnauthorizedException('Wallet address does not match registered address');
    }

    const existingWallet = await this.repo.findAdminByWalletExcludingUser(walletAddress, userId);
    if (existingWallet) {
      throw new UnauthorizedException('Wallet is already bound to another admin');
    }

    return this.walletChallenge.create(user.adminProfile!.id, walletAddress, WALLET_PURPOSE_BIND, user.id);
  }
}
