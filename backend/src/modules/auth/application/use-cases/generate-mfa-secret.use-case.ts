import { ForbiddenException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { AUTH_REPOSITORY, AuthRepositoryPort } from '../ports/auth.repository.port';
import { ACCESS_TOKEN_SIGNER, AccessTokenSignerPort } from '../ports/access-token-signer.port';
import { ENCRYPTION_PORT, EncryptionPort } from '../ports/encryption.port';
import { AuthUserLookupService } from '../services/auth-user-lookup.service';
import { toPublicUser } from '../../domain/public-user';

/**
 * Generates the admin recovery secret and finalizes account activation. Behavior
 * copied verbatim from the former AuthService.generateMfaSecret(): guards on
 * first-login/face/wallet/existing-secret, encrypts the secret, activates the
 * account (step 4, clear invite), and returns a verified token + the raw secret.
 */
@Injectable()
export class GenerateMfaSecretUseCase {
  constructor(
    @Inject(AUTH_REPOSITORY) private readonly repo: AuthRepositoryPort,
    @Inject(ACCESS_TOKEN_SIGNER) private readonly tokenSigner: AccessTokenSignerPort,
    @Inject(ENCRYPTION_PORT) private readonly cipher: EncryptionPort,
    private readonly lookup: AuthUserLookupService,
  ) {}

  async execute(userId: string) {
    const user = await this.lookup.getAdminUser(userId);

    if (!user.firstLogin) {
      throw new ForbiddenException('Recovery secret has already been generated');
    }
    if (!user.faceEmbedding) {
      throw new UnauthorizedException('Please register face before generating recovery secret');
    }
    if (!user.adminProfile!.walletAddress) {
      throw new UnauthorizedException('Please bind wallet before generating recovery secret');
    }
    if (user.adminProfile!.mfaSecret) {
      throw new ForbiddenException('Recovery secret has already been generated');
    }

    const secret = this.cipher.generateSecret();
    const encrypted = this.cipher.encryptSecret(secret);

    const updatedUser = await this.repo.activateAdminWithMfa(userId, encrypted);

    return {
      access_token: this.tokenSigner.sign(updatedUser, { verified: true, walletAddress: updatedUser.adminProfile?.walletAddress }),
      secret,
      activated: true,
      registrationStep: 4,
      user: toPublicUser(updatedUser, true),
    };
  }
}
