import { Inject, Injectable } from '@nestjs/common';
import { AUTH_REPOSITORY, AuthRepositoryPort } from '../ports/auth.repository.port';
import { toPublicUser } from '../../domain/public-user';

/**
 * Persist the user's screen auto-lock preference. The user is free to choose, but the system
 * enforces a security policy range: a shared hospital workstation must never sit unlocked for long,
 * so the idle timeout is clamped to [MIN, MAX] minutes regardless of what the client sends.
 */
export const AUTO_LOCK_MIN_MINUTES = 1;
export const AUTO_LOCK_MAX_MINUTES = 15; // hard ceiling: clinical workstations are shared

@Injectable()
export class UpdateAutoLockUseCase {
  constructor(@Inject(AUTH_REPOSITORY) private readonly repo: AuthRepositoryPort) {}

  async execute(userId: string, minutes: number) {
    const clamped = Math.min(
      AUTO_LOCK_MAX_MINUTES,
      Math.max(AUTO_LOCK_MIN_MINUTES, Math.round(Number(minutes) || AUTO_LOCK_MIN_MINUTES)),
    );
    const user = await this.repo.updateAutoLockMinutes(userId, clamped);
    return { user: toPublicUser(user, true), autoLockMinutes: clamped };
  }
}
