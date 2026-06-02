import { UserWithProfile } from '../application/ports/auth.repository.port';

/**
 * Public projection of a user, extracted verbatim from the former
 * AuthService.toPublicUser(). Keeps the exact response field shape.
 */
export function toPublicUser(user: UserWithProfile, verified: boolean) {
  return {
    id: user.id,
    username: user.username,
    role: user.role,
    email: user.email,
    status: user.status,
    verified,
    firstLogin: user.firstLogin,
    registrationStep: user.registrationStep,
    walletAddress: user.adminProfile?.walletAddress,
    hasFace: Boolean(user.faceEmbedding),
    hasWallet: Boolean(user.adminProfile?.walletAddress),
  };
}
