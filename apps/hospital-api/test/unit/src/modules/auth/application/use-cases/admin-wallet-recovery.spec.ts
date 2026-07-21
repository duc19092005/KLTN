import { ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { AdminWalletRecoveryContextService } from '../../../../../../../src/modules/auth/application/services/admin-wallet-recovery-context.service';
import { AdminWalletRecoveryConfirmUseCase } from '../../../../../../../src/modules/auth/application/use-cases/admin-wallet-recovery-confirm.use-case';
import { WalletLoginUseCase } from '../../../../../../../src/modules/auth/application/use-cases/wallet-login.use-case';

const OLD_WALLET = '0x1000000000000000000000000000000000000001';
const NEW_WALLET = '0x2000000000000000000000000000000000000002';

function createAdmin() {
  return {
    id: 'admin-1',
    username: 'admin',
    email: 'admin@example.local',
    role: 'ADMIN',
    status: 'ACTIVE',
    firstLogin: false,
    registrationStep: 4,
    tokenVersion: 3,
    deletedAt: null,
    faceEmbedding: 'encrypted-face',
    adminProfile: {
      id: 'admin-profile-1',
      userId: 'admin-1',
      walletAddress: OLD_WALLET,
      nonce: 'nonce',
      noncePurpose: 'RECOVER_ADMIN_WALLET',
      nonceExpiresAt: new Date(Date.now() + 60_000),
    },
  };
}

describe('Admin wallet recovery', () => {
  it('requires face verification after every Admin wallet login', async () => {
    const admin = createAdmin();
    const repo = { findAdminByWallet: jest.fn().mockResolvedValue({ ...admin.adminProfile, user: admin }) };
    const tokenSigner = { sign: jest.fn().mockReturnValue('unverified-token') };
    const chain = { isAuthorized: jest.fn().mockResolvedValue(true) };
    const walletChallenge = { consume: jest.fn().mockResolvedValue(undefined) };
    const useCase = new WalletLoginUseCase(
      repo as never,
      tokenSigner as never,
      chain as never,
      { write: jest.fn() } as never,
      walletChallenge as never,
    );

    const result = await useCase.execute(OLD_WALLET, 'signature', 'message');

    expect(tokenSigner.sign).toHaveBeenCalledWith(admin, {
      verified: false,
      walletAddress: OLD_WALLET,
    });
    expect(result.requireVerification).toBe(true);
    expect(result.user.verified).toBe(false);
  });

  it('fails closed unless exactly one Admin account exists', async () => {
    const repo = { findAdminUsers: jest.fn().mockResolvedValue([createAdmin(), { ...createAdmin(), id: 'admin-2' }]) };
    const context = new AdminWalletRecoveryContextService(repo as never, {} as never);

    await expect(context.getSoleActiveAdmin()).rejects.toThrow(ServiceUnavailableException);
  });

  it('rejects an expired or invalid recovery token', () => {
    const admin = createAdmin();
    const context = new AdminWalletRecoveryContextService(
      {} as never,
      { verify: jest.fn().mockImplementation(() => { throw new Error('expired'); }) } as never,
    );

    expect(() => context.verifyRecoveryToken('expired-token', admin as never)).toThrow(UnauthorizedException);
  });

  it('rotates the wallet on-chain, updates the DB and invalidates old sessions', async () => {
    const admin = createAdmin();
    const repo = {
      findAdminByWalletExcludingUser: jest.fn().mockResolvedValue(null),
      replaceAdminWalletAndInvalidateSessions: jest.fn().mockResolvedValue(undefined),
    };
    const chain = {
      isAuthorized: jest.fn().mockResolvedValue(false),
      rotateAdmin: jest.fn().mockResolvedValue({ success: true, txHash: '0xtx' }),
    };
    const audit = { write: jest.fn().mockResolvedValue(undefined) };
    const context = {
      getSoleActiveAdmin: jest.fn().mockResolvedValue(admin),
      verifyRecoveryToken: jest.fn().mockReturnValue({ sub: admin.id }),
    };
    const walletChallenge = { consume: jest.fn().mockResolvedValue(undefined) };
    const useCase = new AdminWalletRecoveryConfirmUseCase(
      repo as never,
      chain as never,
      audit as never,
      context as never,
      walletChallenge as never,
    );

    const result = await useCase.execute('recovery-token', NEW_WALLET, 'signature', 'message', '127.0.0.1');

    expect(walletChallenge.consume).toHaveBeenCalled();
    expect(chain.rotateAdmin).toHaveBeenCalledWith(OLD_WALLET, NEW_WALLET);
    expect(repo.replaceAdminWalletAndInvalidateSessions).toHaveBeenCalledWith(
      admin.id,
      OLD_WALLET,
      NEW_WALLET,
    );
    expect(audit.write).toHaveBeenCalledWith(
      admin.id,
      'ADMIN_WALLET_RECOVERY_EXECUTED',
      'User',
      admin.id,
      expect.objectContaining({ blockchainTxHash: '0xtx' }),
    );
    expect(result.success).toBe(true);
  });

  it('compensates the blockchain rotation when the DB update fails', async () => {
    const admin = createAdmin();
    const repo = {
      findAdminByWalletExcludingUser: jest.fn().mockResolvedValue(null),
      replaceAdminWalletAndInvalidateSessions: jest.fn().mockRejectedValue(new Error('DB unavailable')),
    };
    const chain = {
      isAuthorized: jest.fn().mockResolvedValue(false),
      rotateAdmin: jest
        .fn()
        .mockResolvedValueOnce({ success: true, txHash: '0xtx' })
        .mockResolvedValueOnce({ success: true, txHash: '0xrollback' }),
    };
    const context = {
      getSoleActiveAdmin: jest.fn().mockResolvedValue(admin),
      verifyRecoveryToken: jest.fn(),
    };
    const useCase = new AdminWalletRecoveryConfirmUseCase(
      repo as never,
      chain as never,
      { write: jest.fn().mockResolvedValue(undefined) } as never,
      context as never,
      { consume: jest.fn().mockResolvedValue(undefined) } as never,
    );

    await expect(
      useCase.execute('recovery-token', NEW_WALLET, 'signature', 'message'),
    ).rejects.toThrow('Thông tin ví Admin đã thay đổi trong lúc khôi phục.');
    expect(chain.rotateAdmin).toHaveBeenNthCalledWith(2, NEW_WALLET, OLD_WALLET);
  });
});
