import { Injectable } from '@nestjs/common';
import { BootstrapAdminUseCase } from '../application/use-cases/bootstrap-admin.use-case';
import { InviteLoginUseCase } from '../application/use-cases/invite-login.use-case';
import { PasswordLoginUseCase } from '../application/use-cases/password-login.use-case';
import { ChangePasswordUseCase } from '../application/use-cases/change-password.use-case';
import { RegisterFaceUseCase } from '../application/use-cases/register-face.use-case';
import { WalletBindChallengeUseCase } from '../application/use-cases/wallet-bind-challenge.use-case';
import { VerifyWalletUseCase } from '../application/use-cases/verify-wallet.use-case';
import { WalletLoginChallengeUseCase } from '../application/use-cases/wallet-login-challenge.use-case';
import { WalletLoginUseCase } from '../application/use-cases/wallet-login.use-case';
import { CreateFaceChallengeUseCase } from '../application/use-cases/create-face-challenge.use-case';
import { VerifyFaceUseCase } from '../application/use-cases/verify-face.use-case';
import { VerifyFaceForStepUpUseCase } from '../application/use-cases/verify-face-for-stepup.use-case';
import { GenerateMfaSecretUseCase } from '../application/use-cases/generate-mfa-secret.use-case';
import { GetMeUseCase } from '../application/use-cases/get-me.use-case';
import { GetMyProfileUseCase } from '../application/use-cases/get-my-profile.use-case';
import { LogoutUseCase } from '../application/use-cases/logout.use-case';
import { ForgotPasswordChallengeUseCase } from '../application/use-cases/forgot-password-challenge.use-case';
import { ForgotPasswordVerifyFaceUseCase } from '../application/use-cases/forgot-password-verify-face.use-case';
import { ForgotPasswordResetUseCase } from '../application/use-cases/forgot-password-reset.use-case';

/**
 * Facade preserving the controller-facing API. Each method delegates to a
 * single use case; no business logic lives here (Clean Architecture refactor).
 * Method names/signatures are unchanged so the controller and HTTP contract are
 * identical.
 */
@Injectable()
export class AuthService {
  constructor(
    private readonly bootstrapAdminUseCase: BootstrapAdminUseCase,
    private readonly inviteLoginUseCase: InviteLoginUseCase,
    private readonly passwordLoginUseCase: PasswordLoginUseCase,
    private readonly changePasswordUseCase: ChangePasswordUseCase,
    private readonly registerFaceUseCase: RegisterFaceUseCase,
    private readonly walletBindChallengeUseCase: WalletBindChallengeUseCase,
    private readonly verifyWalletUseCase: VerifyWalletUseCase,
    private readonly walletLoginChallengeUseCase: WalletLoginChallengeUseCase,
    private readonly walletLoginUseCase: WalletLoginUseCase,
    private readonly createFaceChallengeUseCase: CreateFaceChallengeUseCase,
    private readonly verifyFaceUseCase: VerifyFaceUseCase,
    private readonly verifyFaceForStepUpUseCase: VerifyFaceForStepUpUseCase,
    private readonly generateMfaSecretUseCase: GenerateMfaSecretUseCase,
    private readonly getMeUseCase: GetMeUseCase,
    private readonly getMyProfileUseCase: GetMyProfileUseCase,
    private readonly logoutUseCase: LogoutUseCase,
    private readonly forgotPasswordChallengeUseCase: ForgotPasswordChallengeUseCase,
    private readonly forgotPasswordVerifyFaceUseCase: ForgotPasswordVerifyFaceUseCase,
    private readonly forgotPasswordResetUseCase: ForgotPasswordResetUseCase,
  ) {}

  bootstrapFirstAdmin(username: string, email: string, superAdminSecret: string) {
    return this.bootstrapAdminUseCase.execute(username, email, superAdminSecret);
  }

  loginWithInviteToken(inviteToken: string) {
    return this.inviteLoginUseCase.execute(inviteToken);
  }

  loginWithPassword(usernameOrEmail: string, password: string) {
    return this.passwordLoginUseCase.execute(usernameOrEmail, password);
  }

  changePassword(userId: string, currentPassword: string, newPassword: string) {
    return this.changePasswordUseCase.execute(userId, currentPassword, newPassword);
  }

  registerFace(userId: string, embedding: number[] | number[][]) {
    return this.registerFaceUseCase.execute(userId, embedding);
  }

  walletBindChallenge(userId: string, address: string) {
    return this.walletBindChallengeUseCase.execute(userId, address);
  }

  verifyWallet(userId: string, address: string, signature: string, message: string) {
    return this.verifyWalletUseCase.execute(userId, address, signature, message);
  }

  walletChallenge(walletAddress: string) {
    return this.walletLoginChallengeUseCase.execute(walletAddress);
  }

  walletLogin(walletAddress: string, signature: string, message: string) {
    return this.walletLoginUseCase.execute(walletAddress, signature, message);
  }

  createFaceChallenge(userId: string) {
    return this.createFaceChallengeUseCase.execute(userId);
  }

  verifyFace(userId: string, embedding: number[], challenge: string, tokenWalletAddress?: string, ip?: string) {
    return this.verifyFaceUseCase.execute(userId, embedding, challenge, tokenWalletAddress, ip);
  }

  verifyFaceForStepUp(
    userId: string,
    embedding: number[],
    challenge: string,
    action: string,
    resourceId?: string | null,
    ip?: string,
  ) {
    return this.verifyFaceForStepUpUseCase.execute(userId, embedding, challenge, action, resourceId, ip);
  }

  generateMfaSecret(userId: string) {
    return this.generateMfaSecretUseCase.execute(userId);
  }

  getMe(userId: string, verified: boolean) {
    return this.getMeUseCase.execute(userId, verified);
  }

  getMyProfile(userId: string) {
    return this.getMyProfileUseCase.execute(userId);
  }

  logout(userId: string) {
    return this.logoutUseCase.logout(userId);
  }

  logoutToken(token?: string) {
    return this.logoutUseCase.logoutToken(token);
  }

  forgotPasswordChallenge(username: string) {
    return this.forgotPasswordChallengeUseCase.execute(username);
  }

  forgotPasswordVerifyFace(userId: string, embedding: number[], challenge: string, ip?: string) {
    return this.forgotPasswordVerifyFaceUseCase.execute(userId, embedding, challenge, ip);
  }

  forgotPasswordReset(resetToken: string, newPassword: string, ip?: string) {
    return this.forgotPasswordResetUseCase.execute(resetToken, newPassword, ip);
  }
}
