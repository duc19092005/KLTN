import { BadRequestException, ConflictException, Inject, Injectable } from '@nestjs/common';
import { AUTH_REPOSITORY, AuthRepositoryPort } from '../ports/auth.repository.port';
import { AUTH_CHAIN_GATEWAY, AuthChainGatewayPort } from '../ports/auth-chain-gateway.port';
import { AdminWalletRecoveryContextService } from '../services/admin-wallet-recovery-context.service';
import { WalletChallengeService } from '../services/wallet-challenge.service';
import { WALLET_PURPOSE_ADMIN_RECOVERY } from '../../domain/auth.constants';
import { normalizeWalletAddress } from '../../domain/wallet.util';

@Injectable()
export class AdminWalletRecoveryWalletChallengeUseCase {
  constructor(
    @Inject(AUTH_REPOSITORY) private readonly repo: AuthRepositoryPort,
    @Inject(AUTH_CHAIN_GATEWAY) private readonly chain: AuthChainGatewayPort,
    private readonly context: AdminWalletRecoveryContextService,
    private readonly walletChallenge: WalletChallengeService,
  ) {}

  async execute(recoveryToken: string, address: string) {
    const admin = await this.context.getSoleActiveAdmin();
    this.context.verifyRecoveryToken(recoveryToken, admin);

    const profile = admin.adminProfile!;
    if (!profile.walletAddress) {
      throw new BadRequestException('Admin chưa có ví cũ để thực hiện thay đổi.');
    }

    const newWalletAddress = normalizeWalletAddress(address);
    if (profile.walletAddress.toLowerCase() === newWalletAddress.toLowerCase()) {
      throw new BadRequestException('Ví mới phải khác ví Admin hiện tại.');
    }

    const duplicate = await this.repo.findAdminByWalletExcludingUser(newWalletAddress, admin.id);
    if (duplicate || (await this.chain.isAuthorized(newWalletAddress))) {
      throw new ConflictException('Ví mới đã được sử dụng hoặc đã có quyền Admin trên blockchain.');
    }

    return this.walletChallenge.create(
      profile.id,
      newWalletAddress,
      WALLET_PURPOSE_ADMIN_RECOVERY,
      admin.id,
    );
  }
}
