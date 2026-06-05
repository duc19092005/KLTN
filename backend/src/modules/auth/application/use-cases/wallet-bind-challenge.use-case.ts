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
      throw new ForbiddenException('Chỉ có thể liên kết ví trong lần thiết lập quản trị đầu tiên.');
    }
    if (!user.faceEmbedding) {
      throw new UnauthorizedException('Vui lòng đăng ký khuôn mặt trước khi liên kết ví.');
    }
    if (
      user.adminProfile!.walletAddress &&
      user.adminProfile!.walletAddress.toLowerCase() !== walletAddress.toLowerCase()
    ) {
      throw new UnauthorizedException('Địa chỉ ví không khớp với ví đã đăng ký.');
    }

    const existingWallet = await this.repo.findAdminByWalletExcludingUser(walletAddress, userId);
    if (existingWallet) {
      throw new UnauthorizedException('Ví này đã được liên kết với quản trị viên khác.');
    }

    return this.walletChallenge.create(user.adminProfile!.id, walletAddress, WALLET_PURPOSE_BIND, user.id);
  }
}
