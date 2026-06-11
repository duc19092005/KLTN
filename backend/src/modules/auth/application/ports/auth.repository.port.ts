import {
  AdminProfile,
  Department,
  DoctorProfile,
  StaffProfile,
  User,
  UserRole,
} from '@prisma/client';

/** DI token for the Auth repository port. */
export const AUTH_REPOSITORY = Symbol('AUTH_REPOSITORY');

export type UserWithProfile = User & {
  adminProfile: AdminProfile | null;
  staffProfile?: (StaffProfile & { managedDepartment: Department | null }) | null;
};
export type AdminProfileWithUser = AdminProfile & { user: User };

/**
 * Full identity graph for "view my profile": admin profile plus the staff
 * profile with its department and (for doctors) the doctor profile. Used only by
 * the read-only profile endpoint.
 */
export type UserWithFullProfile = User & {
  adminProfile: AdminProfile | null;
  staffProfile:
    | (StaffProfile & {
        department: Department | null;
        doctorProfile: DoctorProfile | null;
        managedDepartment: Department | null;
      })
    | null;
};

export type CreateBootstrapAdminData = {
  username: string;
  email: string;
  inviteTokenHash: string;
  inviteTokenExpiry: Date;
};

export type FaceEnrollmentData = {
  faceEmbedding: string;
  faceHash: string;
  faceModelVersion: string;
  faceSampleCount: number;
  registrationStep: number;
};

/**
 * Persistence boundary for auth. The Prisma implementation preserves the exact
 * queries, atomic updateMany anti-replay semantics (returning the affected
 * count), and transactions from the former AuthService.
 */
export interface AuthRepositoryPort {
  findFirstAdmin(): Promise<{ id: string } | null>;
  createBootstrapAdmin(data: CreateBootstrapAdminData): Promise<User>;

  findUserByInviteTokenCandidates(candidates: string[]): Promise<UserWithProfile | null>;
  updateInviteTokenHash(userId: string, inviteTokenHash: string): Promise<void>;

  findUserByIdentity(username: string, emailLower: string): Promise<UserWithProfile | null>;
  findUserWithProfile(userId: string): Promise<UserWithProfile | null>;
  /** Full identity graph (admin + staff + department + doctor) for the read-only profile view. */
  findUserFullProfile(userId: string): Promise<UserWithFullProfile | null>;

  updatePasswordChange(userId: string, passwordHash: string, registrationStep: number): Promise<UserWithProfile>;
  updateFaceEnrollment(userId: string, data: FaceEnrollmentData): Promise<void>;
  setFaceChallenge(userId: string, challenge: string, expiresAt: Date): Promise<void>;

  findAdminByWalletExcludingUser(walletAddress: string, excludeUserId: string): Promise<{ id: string } | null>;
  findAdminByWallet(walletAddress: string): Promise<AdminProfileWithUser | null>;

  setWalletNonce(adminProfileId: string, nonce: string, purpose: string, expiresAt: Date): Promise<void>;
  /** Atomic anti-replay nonce consume; returns affected row count (must be 1). */
  consumeWalletNonce(adminProfileId: string, nonce: string, purpose: string, now: Date): Promise<number>;

  /** Atomic: set adminProfile.walletAddress + bump user.registrationStep to 3. */
  bindAdminWallet(userId: string, walletAddress: string): Promise<{ profile: AdminProfile; user: UserWithProfile }>;

  /** Activate admin (firstLogin=false, ACTIVE, step 4, clear invite) + store mfa secret. */
  activateAdminWithMfa(userId: string, encryptedSecret: string): Promise<UserWithProfile>;

  bumpTokenVersion(userId: string): Promise<void>;

  /** Atomic anti-replay face challenge consume; returns affected row count (must be 1). */
  consumeFaceChallenge(userId: string, challenge: string, now: Date): Promise<number>;
  updateFaceFailure(userId: string, failedFaceAttempts: number, faceLockedUntil: Date | null): Promise<void>;
  resetFaceFailures(userId: string): Promise<void>;

  /** Persist the user's screen auto-lock preference (idle minutes). Caller clamps the range. */
  updateAutoLockMinutes(userId: string, minutes: number): Promise<UserWithProfile>;
}

export type { UserRole };
