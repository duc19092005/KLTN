import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './controllers/auth.controller';
import { AuthService } from './services/auth.service';
import { AuthRateLimiterService } from './services/auth-rate-limiter.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { EncryptionModule } from '../encryption/encryption.module';
import { BlockchainModule } from '../../infrastructure/blockchain/blockchain.module';
import { getJwtSecret } from './constants/auth-security';

// Application services (shared workflow helpers)
import { AuthUserLookupService } from './application/services/auth-user-lookup.service';
import { WalletChallengeService } from './application/services/wallet-challenge.service';
import { FaceMatchService } from './application/services/face-match.service';

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
import { LogoutUseCase } from './application/use-cases/logout.use-case';

// Ports + adapters
import { AUTH_REPOSITORY } from './application/ports/auth.repository.port';
import { ACCESS_TOKEN_SIGNER } from './application/ports/access-token-signer.port';
import { SECURITY_EVENT_LOGGER } from './application/ports/security-event-logger.port';
import { AUTH_CHAIN_GATEWAY } from './application/ports/auth-chain-gateway.port';
import { ENCRYPTION_PORT } from './application/ports/encryption.port';
import { STEPUP_TICKET_ISSUER } from './application/ports/stepup-ticket-issuer.port';
import { PrismaAuthRepository } from './infrastructure/prisma/prisma-auth.repository';
import { JwtAccessTokenSigner } from './infrastructure/adapters/jwt-access-token.signer';
import { DualWriteSecurityEventLogger } from './infrastructure/adapters/dual-write-security-event.logger';
import { BlockchainAuthChainGateway } from './infrastructure/adapters/blockchain-auth-chain.gateway';
import { EncryptionAdapter } from './infrastructure/adapters/encryption.adapter';
import { StepUpTicketIssuerAdapter } from './infrastructure/adapters/stepup-ticket-issuer.adapter';

@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      useFactory: () => ({
        secret: getJwtSecret(),
        signOptions: { expiresIn: (process.env.JWT_EXPIRATION || '1h') as any },
      }),
    }),
    EncryptionModule,
    BlockchainModule,
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    AuthRateLimiterService,
    JwtStrategy,

    // Shared application services
    AuthUserLookupService,
    WalletChallengeService,
    FaceMatchService,

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
    LogoutUseCase,

    // Ports -> adapters
    { provide: AUTH_REPOSITORY, useClass: PrismaAuthRepository },
    { provide: ACCESS_TOKEN_SIGNER, useClass: JwtAccessTokenSigner },
    { provide: SECURITY_EVENT_LOGGER, useClass: DualWriteSecurityEventLogger },
    { provide: AUTH_CHAIN_GATEWAY, useClass: BlockchainAuthChainGateway },
    { provide: ENCRYPTION_PORT, useClass: EncryptionAdapter },
    { provide: STEPUP_TICKET_ISSUER, useClass: StepUpTicketIssuerAdapter },
  ],
  exports: [AuthService, JwtModule],
})
export class AuthModule {}
