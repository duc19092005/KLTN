import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { User } from '@prisma/client';
import { AUTH_REPOSITORY, AuthRepositoryPort } from '../ports/auth.repository.port';
import { ENCRYPTION_PORT, EncryptionPort } from '../ports/encryption.port';
import { AUTH_CHAIN_GATEWAY, AuthChainGatewayPort } from '../ports/auth-chain-gateway.port';
import { hashToBytes32 } from '../../../../infrastructure/audit/audit-hash.util';
import { FACE_MAX_FAILED_ATTEMPTS, FACE_LOCKOUT_MS } from '../../domain/auth.constants';
import { computeFaceHash, euclideanDistance, getFaceMatchThreshold, validateFaceDescriptorSet } from '../../domain/face.util';

export type IntegrityCheck = { ok: boolean; recomputedFaceHash: string | null; onChainFaceHash: string | null };
export type MatchResult = { distance: number; meanDistance: number; threshold: number; passed: boolean };

/**
 * Shared face-template handling used by verifyFace and verifyFaceForStepUp.
 * Decode, on-chain integrity gate, euclidean matching, and failure/lock
 * bookkeeping are copied verbatim from the former AuthService; only the audit
 * writes (whose metadata differs per flow) remain in the use cases.
 */
@Injectable()
export class FaceMatchService {
  constructor(
    @Inject(AUTH_REPOSITORY) private readonly repo: AuthRepositoryPort,
    @Inject(ENCRYPTION_PORT) private readonly cipher: EncryptionPort,
    @Inject(AUTH_CHAIN_GATEWAY) private readonly chain: AuthChainGatewayPort,
  ) {}

  decodeStoredDescriptors(faceEmbedding: string): number[][] {
    try {
      const plaintext = faceEmbedding.trim().startsWith('[') ? faceEmbedding : this.cipher.decryptSecret(faceEmbedding);
      const parsed = JSON.parse(plaintext);
      return validateFaceDescriptorSet(parsed);
    } catch {
      throw new UnauthorizedException({
        code: 'FACE_TEMPLATE_TAMPERED',
        message: 'Dữ liệu khuôn mặt đã lưu không hợp lệ hoặc đã bị thay đổi.',
      });
    }
  }

  /**
   * Integrity gate: recompute the stored template hash and compare to the
   * immutable on-chain anchor. A missing anchor is treated as "not protected
   * yet" (ok=true). The use case audits + throws when ok=false.
   */
  async checkIntegrity(
    userId: string,
    storedDescriptors: number[][],
    requireAnchor = false,
  ): Promise<IntegrityCheck> {
    const onChainFaceHash = await this.chain.getFaceHash(userId);
    if (!onChainFaceHash) return { ok: !requireAnchor, recomputedFaceHash: null, onChainFaceHash: null };
    const recomputedFaceHash = hashToBytes32(computeFaceHash(storedDescriptors)).toLowerCase();
    return {
      ok: recomputedFaceHash === onChainFaceHash.toLowerCase(),
      recomputedFaceHash,
      onChainFaceHash: onChainFaceHash.toLowerCase(),
    };
  }

  computeMatch(descriptor: number[], storedDescriptors: number[][]): MatchResult {
    const distances = storedDescriptors.map((stored) => euclideanDistance(descriptor, stored));
    const distance = Math.min(...distances);
    const meanDistance = distances.reduce((sum, value) => sum + value, 0) / distances.length;
    const threshold = getFaceMatchThreshold();
    return { distance, meanDistance, threshold, passed: distance <= threshold };
  }

  async recordFailure(user: User): Promise<{ failedAttempts: number; locked: boolean }> {
    const failedAttempts = (user.failedFaceAttempts ?? 0) + 1;
    const locked = failedAttempts >= FACE_MAX_FAILED_ATTEMPTS;
    await this.repo.updateFaceFailure(
      user.id,
      // Reset the counter once locked; the lock window itself blocks further attempts.
      locked ? 0 : failedAttempts,
      locked ? new Date(Date.now() + FACE_LOCKOUT_MS) : (user.faceLockedUntil ?? null),
    );
    return { failedAttempts, locked };
  }

  resetFailures(userId: string): Promise<void> {
    return this.repo.resetFaceFailures(userId);
  }
}
