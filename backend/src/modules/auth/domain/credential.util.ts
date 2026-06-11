import * as crypto from 'crypto';

/**
 * Pure credential crypto, extracted verbatim from the former AuthService
 * (hashPassword, verifyPassword, hashInviteToken, timingSafeEquals).
 *
 * NOTE: password hashing keeps the existing SHA-256 scheme with bcrypt-compat
 * verification so already-stored hashes keep working. This is preserved exactly
 * from the original implementation; do not change without a migration.
 */

export function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex');
}

export function verifyPassword(password: string, passwordHash: string): boolean {
  if (passwordHash.startsWith('$2a$') || passwordHash.startsWith('$2b$') || passwordHash.startsWith('$2y$')) {
    return require('bcrypt').compareSync(password, passwordHash);
  }
  return hashPassword(password) === passwordHash;
}

export function hashInviteToken(inviteToken: string): string {
  return `sha256:${crypto.createHash('sha256').update(inviteToken).digest('hex')}`;
}

export function timingSafeEquals(leftValue: string, rightValue: string): boolean {
  const left = crypto.createHash('sha256').update(leftValue).digest();
  const right = crypto.createHash('sha256').update(rightValue).digest();
  return crypto.timingSafeEqual(left, right);
}
