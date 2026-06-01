import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import * as crypto from 'crypto';

/**
 * Pure face-biometric math + validation, extracted verbatim from the former
 * AuthService (validateFaceDescriptor, validateFaceDescriptorSet,
 * computeFaceHash, euclideanDistance, getFaceMatchThreshold).
 */

export function validateFaceDescriptor(embedding: unknown): number[] {
  if (!Array.isArray(embedding) || embedding.length !== 128) {
    throw new BadRequestException('Invalid face descriptor. Expected 128D face-api descriptor.');
  }

  return embedding.map((value) => {
    const numberValue = Number(value);
    if (!Number.isFinite(numberValue) || numberValue < -2 || numberValue > 2) {
      throw new BadRequestException('Invalid face descriptor value');
    }
    return Number(numberValue.toFixed(6));
  });
}

export function validateFaceDescriptorSet(embedding: unknown): number[][] {
  if (!Array.isArray(embedding)) {
    throw new BadRequestException('Invalid face descriptor payload.');
  }

  const candidates = Array.isArray(embedding[0]) ? embedding : [embedding];
  if (candidates.length < 3 || candidates.length > 15) {
    throw new BadRequestException('Expected 3 to 15 face descriptors for reliable enrollment.');
  }

  return candidates.map((candidate) => validateFaceDescriptor(candidate));
}

/**
 * Canonical integrity hash of a face template: SHA256 over the JSON of the validated
 * descriptor set. Used both at enrollment (anchored on-chain) and on login (recomputed
 * and compared to the on-chain anchor). Must stay in sync with how descriptors are stored.
 */
export function computeFaceHash(descriptors: number[][]): string {
  return crypto.createHash('sha256').update(JSON.stringify(descriptors)).digest('hex');
}

export function euclideanDistance(a: number[], b: number[]): number {
  if (a.length !== b.length) return Number.POSITIVE_INFINITY;
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const diff = a[i] - b[i];
    sum += diff * diff;
  }
  return Math.sqrt(sum);
}

export function getFaceMatchThreshold(): number {
  // face-api euclidean distance: <0.42 = same person, 0.42-0.5 = borderline, >0.5 = different person.
  // Default 0.45 balances security vs usability. Hard-capped at 0.5 so a loose env value
  // (e.g. 0.6) cannot weaken matching below acceptable security for a clinical system.
  const DEFAULT = 0.45;
  const MAX_SAFE = 0.5;
  const threshold = Number(process.env.FACE_MATCH_THRESHOLD ?? DEFAULT);
  if (!Number.isFinite(threshold) || threshold <= 0 || threshold > 1) {
    return DEFAULT;
  }
  return Math.min(threshold, MAX_SAFE);
}

export function assertNotFaceLocked(user: { faceLockedUntil?: Date | null }) {
  if (user.faceLockedUntil && user.faceLockedUntil > new Date()) {
    const remainingMin = Math.ceil((user.faceLockedUntil.getTime() - Date.now()) / 60000);
    throw new UnauthorizedException(
      `Face verification is temporarily locked. Try again in ${remainingMin} minute(s).`,
    );
  }
}
