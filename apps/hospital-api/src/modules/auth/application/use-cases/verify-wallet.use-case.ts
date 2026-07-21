import { ForbiddenException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { AUTH_REPOSITORY, AuthRepositoryPort } from '../ports/auth.repository.port';
import { ACCESS_TOKEN_SIGNER, AccessTokenSignerPort } from '../ports/access-token-signer.port';
import { AUTH_CHAIN_GATEWAY, AuthChainGatewayPort } from '../ports/auth-chain-gateway.port';
import { AuthUserLookupService } from '../services/auth-user-lookup.service';
import { WalletChallengeService } from '../services/wallet-challenge.service';
import { WALLET_PURPOSE_BIND } from '../../domain/auth.constants';
import { normalizeWalletAddress } from '../../domain/wallet.util';
import { toPublicUser } from '../../domain/public-user';

/**
 * Verifies the wallet-bind signature, authorizes the wallet on-chain, and binds
 * it to the admin. Behavior copied verbatim from the former AuthService.verifyWallet():
 * guards, challenge consume, on-chain authorizeAdmin, atomic bind + step 3, token.
 */
@Injectable()
export class VerifyWalletUseCase {
  constructor(
    @Inject(AUTH_REPOSITORY) private readonly repo: AuthRepositoryPort,
    @Inject(ACCESS_TOKEN_SIGNER) private readonly tokenSigner: AccessTokenSignerPort,
    @Inject(AUTH_CHAIN_GATEWAY) private readonly chain: AuthChainGatewayPort,
    private readonly lookup: AuthUserLookupService,
    private readonly walletChallenge: WalletChallengeService,
  ) {}

  async execute(userId: string, address: string, signature: string, message: string) {
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

    await this.walletChallenge.consume(user.adminProfile!, walletAddress, signature, message, WALLET_PURPOSE_BIND, user.id);

    const chainResult = await this.chain.authorizeAdmin(walletAddress);
    if (!chainResult.success) {
      throw new UnauthorizedException(chainResult.error || 'Failed to authorize wallet on-chain');
    }

    const { profile: updatedProfile, user: updatedUser } = await this.repo.bindAdminWallet(userId, walletAddress);

    return {
      access_token: this.tokenSigner.sign(updatedUser, { verified: false, isFirstLogin: true, walletAddress }),
      verified: false,
      onChain: chainResult,
      registrationStep: 3,
      user: toPublicUser({ ...updatedUser, adminProfile: updatedProfile }, false),
    };
  }
}
