import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import * as crypto from 'crypto';
import { AUTH_REPOSITORY, AuthRepositoryPort } from '../ports/auth.repository.port';
import { AuthUserLookupService } from '../services/auth-user-lookup.service';
import { FACE_CHALLENGE_TTL_MS } from '../../domain/auth.constants';
import { assertNotFaceLocked } from '../../domain/face.util';

/**
 * Issues a single-use face challenge (anti-replay). Behavior copied verbatim
 * from the former AuthService.createFaceChallenge().
 */
@Injectable()
export class CreateFaceChallengeUseCase {
  constructor(
    @Inject(AUTH_REPOSITORY) private readonly repo: AuthRepositoryPort,
    private readonly lookup: AuthUserLookupService,
  ) {}

  async execute(userId: string) {
    const user = await this.lookup.getAuthUser(userId);

    if (!user.faceEmbedding) {
      throw new UnauthorizedException('Face data is not registered');
    }

    assertNotFaceLocked(user);

    const challenge = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + FACE_CHALLENGE_TTL_MS);

    await this.repo.setFaceChallenge(userId, challenge, expiresAt);

    return { challenge, expiresAt: expiresAt.toISOString(), ttlMs: FACE_CHALLENGE_TTL_MS };
  }
}
