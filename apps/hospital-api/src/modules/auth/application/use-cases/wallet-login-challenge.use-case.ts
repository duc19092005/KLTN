import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { AUTH_REPOSITORY, AuthRepositoryPort } from '../ports/auth.repository.port';
import { AUTH_CHAIN_GATEWAY, AuthChainGatewayPort } from '../ports/auth-chain-gateway.port';
import { WalletChallengeService } from '../services/wallet-challenge.service';
import { WALLET_PURPOSE_LOGIN } from '../../domain/auth.constants';
import { normalizeWalletAddress } from '../../domain/wallet.util';

/**
 * Issues a wallet-login challenge. Behavior copied verbatim from the former
 * AuthService.walletChallenge(): validates the admin setup is complete, face is
 * registered, and the wallet is authorized on-chain before issuing the nonce.
 */
@Injectable()
export class WalletLoginChallengeUseCase {
  constructor(
    @Inject(AUTH_REPOSITORY) private readonly repo: AuthRepositoryPort,
    @Inject(AUTH_CHAIN_GATEWAY) private readonly chain: AuthChainGatewayPort,
    private readonly walletChallenge: WalletChallengeService,
  ) {}

  async execute(walletAddress: string) {
    const normalizedWalletAddress = normalizeWalletAddress(walletAddress);
    const adminProfile = await this.repo.findAdminByWallet(normalizedWalletAddress);

    if (!adminProfile) throw new UnauthorizedException('Địa chỉ ví chưa được đăng ký.');
    if (adminProfile.user.status !== 'ACTIVE' || adminProfile.user.firstLogin) {
      throw new UnauthorizedException('Tài khoản quản trị chưa hoàn tất thiết lập.');
    }
    if (!adminProfile.user.faceEmbedding) {
      throw new UnauthorizedException('Tài khoản chưa đăng ký dữ liệu khuôn mặt.');
    }

    const isOnChainAuthorized = await this.chain.isAuthorized(normalizedWalletAddress);
    if (!isOnChainAuthorized) {
      throw new UnauthorizedException('Ví chưa được cấp quyền trên blockchain.');
    }

    return this.walletChallenge.create(adminProfile.id, normalizedWalletAddress, WALLET_PURPOSE_LOGIN);
  }
}
