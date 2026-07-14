import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  InternalServerErrorException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { AUTH_REPOSITORY, AuthRepositoryPort } from '../ports/auth.repository.port';
import { AUTH_CHAIN_GATEWAY, AuthChainGatewayPort } from '../ports/auth-chain-gateway.port';
import { SECURITY_EVENT_LOGGER, SecurityEventLoggerPort } from '../ports/security-event-logger.port';
import { AdminWalletRecoveryContextService } from '../services/admin-wallet-recovery-context.service';
import { WalletChallengeService } from '../services/wallet-challenge.service';
import { WALLET_PURPOSE_ADMIN_RECOVERY } from '../../domain/auth.constants';
import { normalizeWalletAddress } from '../../domain/wallet.util';

@Injectable()
export class AdminWalletRecoveryConfirmUseCase {
  constructor(
    @Inject(AUTH_REPOSITORY) private readonly repo: AuthRepositoryPort,
    @Inject(AUTH_CHAIN_GATEWAY) private readonly chain: AuthChainGatewayPort,
    @Inject(SECURITY_EVENT_LOGGER) private readonly audit: SecurityEventLoggerPort,
    private readonly context: AdminWalletRecoveryContextService,
    private readonly walletChallenge: WalletChallengeService,
  ) {}

  async execute(recoveryToken: string, address: string, signature: string, message: string, ip?: string) {
    const admin = await this.context.getSoleActiveAdmin();
    this.context.verifyRecoveryToken(recoveryToken, admin);

    const profile = admin.adminProfile!;
    if (!profile.walletAddress) {
      throw new BadRequestException('Admin chưa có ví cũ để thực hiện thay đổi.');
    }

    const oldWalletAddress = normalizeWalletAddress(profile.walletAddress);
    const newWalletAddress = normalizeWalletAddress(address);
    if (oldWalletAddress === newWalletAddress) {
      throw new BadRequestException('Ví mới phải khác ví Admin hiện tại.');
    }

    await this.walletChallenge.consume(
      profile,
      newWalletAddress,
      signature,
      message,
      WALLET_PURPOSE_ADMIN_RECOVERY,
      admin.id,
    );

    const duplicate = await this.repo.findAdminByWalletExcludingUser(newWalletAddress, admin.id);
    if (duplicate || (await this.chain.isAuthorized(newWalletAddress))) {
      throw new ConflictException('Ví mới đã được sử dụng hoặc đã có quyền Admin trên blockchain.');
    }

    await this.audit.write(admin.id, 'ADMIN_WALLET_RECOVERY_STARTED', 'User', admin.id, { ip });

    const chainResult = await this.chain.rotateAdmin(oldWalletAddress, newWalletAddress);
    if (!chainResult.success) {
      throw new ServiceUnavailableException(chainResult.error || 'Không thể thay đổi ví Admin trên blockchain.');
    }

    try {
      await this.repo.replaceAdminWalletAndInvalidateSessions(admin.id, oldWalletAddress, newWalletAddress);
    } catch {
      const compensation = await this.chain.rotateAdmin(newWalletAddress, oldWalletAddress);
      if (!compensation.success) {
        throw new InternalServerErrorException(
          'Cập nhật ví trong cơ sở dữ liệu thất bại và blockchain không thể hoàn tác. Cần can thiệp quản trị.',
        );
      }
      throw new ConflictException('Thông tin ví Admin đã thay đổi trong lúc khôi phục. Vui lòng thực hiện lại.');
    }

    await this.audit.write(admin.id, 'ADMIN_WALLET_RECOVERY_EXECUTED', 'User', admin.id, {
      blockchainTxHash: chainResult.txHash ?? null,
      ip,
    });

    return {
      success: true,
      message: 'Đã thay đổi ví Admin. Vui lòng đăng nhập lại bằng ví mới và xác thực khuôn mặt.',
    };
  }
}
