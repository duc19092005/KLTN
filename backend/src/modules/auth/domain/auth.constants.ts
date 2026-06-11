/** Auth domain constants, extracted verbatim from the former AuthService. */
export const INVITE_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
export const WALLET_NONCE_TTL_MS = 5 * 60 * 1000;
export const WALLET_PURPOSE_BIND = 'BIND_ADMIN_WALLET';
export const WALLET_PURPOSE_LOGIN = 'WALLET_LOGIN';

// Biometric face verification
export const FACE_CHALLENGE_TTL_MS = 2 * 60 * 1000;
export const FACE_MODEL_VERSION = 'face-api/tiny-face-detector+landmark68tiny+recognition-128d';
export const FACE_MAX_FAILED_ATTEMPTS = 5;
export const FACE_LOCKOUT_MS = 15 * 60 * 1000;
