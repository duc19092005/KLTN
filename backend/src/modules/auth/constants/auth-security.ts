import { CookieOptions } from 'express';

const DEFAULT_JWT_SECRET = 'default_secret';
const MIN_SECRET_LENGTH = 32;

export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (process.env.NODE_ENV === 'test' && !secret) return 'test_jwt_secret_for_local_tests_only_32';

  if (!secret || secret === DEFAULT_JWT_SECRET || secret.length < MIN_SECRET_LENGTH) {
    throw new Error(`JWT_SECRET must be configured and at least ${MIN_SECRET_LENGTH} characters long`);
  }

  return secret;
}

export function getAuthCookieOptions(): CookieOptions {
  const secure =
    process.env.AUTH_COOKIE_SECURE === 'true' ||
    (process.env.AUTH_COOKIE_SECURE !== 'false' && process.env.NODE_ENV === 'production');
  const sameSite = (process.env.AUTH_COOKIE_SAME_SITE as CookieOptions['sameSite']) || (secure ? 'none' : 'lax');

  // Default 8 hours to cover a typical shift. Override via JWT_COOKIE_MAX_AGE_MS env.
  // IMPORTANT: this should match the JWT token exp claim (configured in the login use-case)
  // so the cookie never outlives the token it carries. If token exp is shorter, set
  // JWT_COOKIE_MAX_AGE_MS to the same value.
  return {
    httpOnly: true,
    secure,
    sameSite,
    path: '/',
    maxAge: Number(process.env.JWT_COOKIE_MAX_AGE_MS || 8 * 60 * 60 * 1000),
  };
}

export function getClearAuthCookieOptions(): CookieOptions {
  const { maxAge, ...options } = getAuthCookieOptions();
  return options;
}
