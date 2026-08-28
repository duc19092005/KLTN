import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './controllers/auth.controller';
import { AuthRecoveryController } from './controllers/auth-recovery.controller';
import { AuthService } from './services/auth.service';
import { AuthRateLimiterService } from './services/auth-rate-limiter.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { EncryptionModule } from '../encryption/encryption.module';
import { BlockchainModule } from '../../infrastructure/blockchain/blockchain.module';
import { AuditModule } from '../../infrastructure/audit/audit.module';
import { getJwtSecret } from './constants/auth-security';

// Application services (shared workflow helpers)
import { AuthUserLookupService } from './application/services/auth-user-lookup.service';
import { WalletChallengeService } from './application/services/wallet-challenge.service';
import { FaceMatchService } from './application/services/face-match.service';
import { AdminWalletRecoveryContextService } from './application/services/admin-wallet-recovery-context.service';

// Use cases
import { BootstrapAdminUseCase } from './application/use-cases/bootstrap-admin.use-case';
import { InviteLoginUseCase } from './application/use-cases/invite-login.use-case';
import { PasswordLoginUseCase } from './application/use-cases/password-login.use-case';
import { ChangePasswordUseCase } from './application/use-cases/change-password.use-case';
import { RegisterFaceUseCase } from './application/use-cases/register-face.use-case';
import { WalletBindChallengeUseCase } from './application/use-cases/wallet-bind-challenge.use-case';
import { VerifyWalletUseCase } from './application/use-cases/verify-wallet.use-case';
import { WalletLoginChallengeUseCase } from './application/use-cases/wallet-login-challenge.use-case';
import { WalletLoginUseCase } from './application/use-cases/wallet-login.use-case';
import { CreateFaceChallengeUseCase } from './application/use-cases/create-face-challenge.use-case';
import { VerifyFaceUseCase } from './application/use-cases/verify-face.use-case';
import { VerifyFaceForStepUpUseCase } from './application/use-cases/verify-face-for-stepup.use-case';
import { GenerateMfaSecretUseCase } from './application/use-cases/generate-mfa-secret.use-case';
import { GetMeUseCase } from './application/use-cases/get-me.use-case';
import { GetMyProfileUseCase } from './application/use-cases/get-my-profile.use-case';
import { LogoutUseCase } from './application/use-cases/logout.use-case';
import { ForgotPasswordChallengeUseCase } from './application/use-cases/forgot-password-challenge.use-case';
import { ForgotPasswordVerifyFaceUseCase } from './application/use-cases/forgot-password-verify-face.use-case';
import { ForgotPasswordResetUseCase } from './application/use-cases/forgot-password-reset.use-case';
import { AdminWalletRecoveryChallengeUseCase } from './application/use-cases/admin-wallet-recovery-challenge.use-case';
import { AdminWalletRecoveryVerifyFaceUseCase } from './application/use-cases/admin-wallet-recovery-verify-face.use-case';
import { AdminWalletRecoveryWalletChallengeUseCase } from './application/use-cases/admin-wallet-recovery-wallet-challenge.use-case';
import { AdminWalletRecoveryConfirmUseCase } from './application/use-cases/admin-wallet-recovery-confirm.use-case';
import { AdminFaceRecoveryChallengeUseCase } from './application/use-cases/admin-face-recovery-challenge.use-case';
import { AdminFaceRecoveryRestoreUseCase } from './application/use-cases/admin-face-recovery-restore.use-case';
import { FaceLoginChallengeUseCase } from './application/use-cases/face-login-challenge.use-case';
import { FaceLoginUseCase } from './application/use-cases/face-login.use-case';

// Ports + adapters
import { AUTH_REPOSITORY } from './application/ports/auth.repository.port';
import { ACCESS_TOKEN_SIGNER } from './application/ports/access-token-signer.port';
import { SECURITY_EVENT_LOGGER } from './application/ports/security-event-logger.port';
import { AUTH_CHAIN_GATEWAY } from './application/ports/auth-chain-gateway.port';
import { ENCRYPTION_PORT } from './application/ports/encryption.port';
import { STEPUP_TICKET_ISSUER } from './application/ports/stepup-ticket-issuer.port';
import { FACE_RECOVERY_ARTIFACT } from './application/ports/face-recovery-artifact.port';
import { PrismaAuthRepository } from './infrastructure/prisma/prisma-auth.repository';
import { JwtAccessTokenSigner } from './infrastructure/adapters/jwt-access-token.signer';
import { DualWriteSecurityEventLogger } from './infrastructure/adapters/dual-write-security-event.logger';
import { BlockchainAuthChainGateway } from './infrastructure/adapters/blockchain-auth-chain.gateway';
import { EncryptionAdapter } from './infrastructure/adapters/encryption.adapter';
import { StepUpTicketIssuerAdapter } from './infrastructure/adapters/stepup-ticket-issuer.adapter';
import { AdminFaceRecoveryArtifactAdapter } from './infrastructure/adapters/admin-face-recovery-artifact.adapter';

@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      useFactory: () => ({
        secret: getJwtSecret(),
        signOptions: { expiresIn: (process.env.JWT_EXPIRATION || '8h') as any },
      }),
    }),
    EncryptionModule,
    BlockchainModule,
    AuditModule,
  ],
  controllers: [AuthController, AuthRecoveryController],
  providers: [
    AuthService,
    AuthRateLimiterService,
    JwtStrategy,

    // Shared application services
    AuthUserLookupService,
    WalletChallengeService,
    FaceMatchService,
    AdminWalletRecoveryContextService,

    // Use cases
    BootstrapAdminUseCase,
    InviteLoginUseCase,
    PasswordLoginUseCase,
    ChangePasswordUseCase,
    RegisterFaceUseCase,
    WalletBindChallengeUseCase,
    VerifyWalletUseCase,
    WalletLoginChallengeUseCase,
    WalletLoginUseCase,
    CreateFaceChallengeUseCase,
    VerifyFaceUseCase,
    VerifyFaceForStepUpUseCase,
    GenerateMfaSecretUseCase,
    GetMeUseCase,
    GetMyProfileUseCase,
    LogoutUseCase,
    ForgotPasswordChallengeUseCase,
    ForgotPasswordVerifyFaceUseCase,
    ForgotPasswordResetUseCase,
    AdminWalletRecoveryChallengeUseCase,
    AdminWalletRecoveryVerifyFaceUseCase,
    AdminWalletRecoveryWalletChallengeUseCase,
    AdminWalletRecoveryConfirmUseCase,
    AdminFaceRecoveryChallengeUseCase,
    AdminFaceRecoveryRestoreUseCase,
    FaceLoginChallengeUseCase,
    FaceLoginUseCase,

    // Ports -> adapters
    { provide: AUTH_REPOSITORY, useClass: PrismaAuthRepository },
    { provide: ACCESS_TOKEN_SIGNER, useClass: JwtAccessTokenSigner },
    { provide: SECURITY_EVENT_LOGGER, useClass: DualWriteSecurityEventLogger },
    { provide: AUTH_CHAIN_GATEWAY, useClass: BlockchainAuthChainGateway },
    { provide: ENCRYPTION_PORT, useClass: EncryptionAdapter },
    { provide: STEPUP_TICKET_ISSUER, useClass: StepUpTicketIssuerAdapter },
    { provide: FACE_RECOVERY_ARTIFACT, useClass: AdminFaceRecoveryArtifactAdapter },
  ],
  exports: [AuthService, JwtModule, FaceMatchService, AUTH_REPOSITORY, SECURITY_EVENT_LOGGER],
})
export class AuthModule {}
