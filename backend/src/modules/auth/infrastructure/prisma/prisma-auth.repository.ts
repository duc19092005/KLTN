import { Injectable } from '@nestjs/common';
import { AdminProfile, User } from '@prisma/client';
import { PrismaService } from '../../../../infrastructure/prisma/prisma.service';
import {
  AdminProfileWithUser,
  AuthRepositoryPort,
  CreateBootstrapAdminData,
  FaceEnrollmentData,
  UserWithFullProfile,
  UserWithProfile,
} from '../../application/ports/auth.repository.port';

/**
 * Prisma-backed auth repository. Preserves the exact queries, the atomic
 * updateMany anti-replay semantics (returning the affected count), and the
 * transactions from the former AuthService.
 */
@Injectable()
export class PrismaAuthRepository implements AuthRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async findFirstAdmin() {
    return this.prisma.user.findFirst({ where: { role: 'ADMIN' }, select: { id: true } });
  }

  async createBootstrapAdmin(data: CreateBootstrapAdminData): Promise<User> {
    return this.prisma.user.create({
      data: {
        username: data.username.trim(),
        email: data.email.trim().toLowerCase(),
        role: 'ADMIN',
        status: 'PENDING',
        firstLogin: true,
        registrationStep: 1,
        inviteToken: data.inviteTokenHash,
        inviteTokenExpiry: data.inviteTokenExpiry,
        adminProfile: { create: { adminUserName: data.username.trim() } },
      },
    });
  }

  async findUserByInviteTokenCandidates(candidates: string[]): Promise<UserWithProfile | null> {
    return this.prisma.user.findFirst({
      where: { inviteToken: { in: candidates } },
      include: { adminProfile: true },
    });
  }

  async updateInviteTokenHash(userId: string, inviteTokenHash: string): Promise<void> {
    await this.prisma.user.update({ where: { id: userId }, data: { inviteToken: inviteTokenHash } });
  }

  async findUserByIdentity(username: string, emailLower: string): Promise<UserWithProfile | null> {
    return this.prisma.user.findFirst({
      where: { OR: [{ username }, { email: emailLower }] },
      include: { adminProfile: true },
    });
  }

  async findUserWithProfile(userId: string): Promise<UserWithProfile | null> {
    return this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        adminProfile: true,
        staffProfile: {
          include: {
            managedDepartment: true,
          },
        },
      },
    });
  }

  async findUserFullProfile(userId: string): Promise<UserWithFullProfile | null> {
    return this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        adminProfile: true,
        staffProfile: {
          include: {
            department: true,
            doctorProfile: true,
            managedDepartment: true,
          },
        },
      },
    });
  }

  async updatePasswordChange(userId: string, passwordHash: string, registrationStep: number): Promise<UserWithProfile> {
    return this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash, firstLogin: false, registrationStep },
      include: { adminProfile: true },
    });
  }

  async updateFaceEnrollment(userId: string, data: FaceEnrollmentData): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        faceEmbedding: data.faceEmbedding,
        faceHash: data.faceHash,
        faceModelVersion: data.faceModelVersion,
        faceEnrolledAt: new Date(),
        faceSampleCount: data.faceSampleCount,
        failedFaceAttempts: 0,
        faceLockedUntil: null,
        registrationStep: data.registrationStep,
      },
    });
  }

  async setFaceChallenge(userId: string, challenge: string, expiresAt: Date): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { faceChallenge: challenge, faceChallengeExpiresAt: expiresAt },
    });
  }

  async findAdminByWalletExcludingUser(walletAddress: string, excludeUserId: string) {
    return this.prisma.adminProfile.findFirst({
      where: { walletAddress: { equals: walletAddress, mode: 'insensitive' }, userId: { not: excludeUserId } },
      select: { id: true },
    });
  }

  async findAdminByWallet(walletAddress: string): Promise<AdminProfileWithUser | null> {
    return this.prisma.adminProfile.findFirst({
      where: { walletAddress: { equals: walletAddress, mode: 'insensitive' } },
      include: { user: true },
    });
  }

  async setWalletNonce(adminProfileId: string, nonce: string, purpose: string, expiresAt: Date): Promise<void> {
    await this.prisma.adminProfile.update({
      where: { id: adminProfileId },
      data: { nonce, noncePurpose: purpose, nonceExpiresAt: expiresAt },
    });
  }

  async consumeWalletNonce(adminProfileId: string, nonce: string, purpose: string, now: Date): Promise<number> {
    const result = await this.prisma.adminProfile.updateMany({
      where: { id: adminProfileId, nonce, noncePurpose: purpose, nonceExpiresAt: { gte: now } },
      data: { nonce: null, noncePurpose: null, nonceExpiresAt: null },
    });
    return result.count;
  }

  async bindAdminWallet(userId: string, walletAddress: string): Promise<{ profile: AdminProfile; user: UserWithProfile }> {
    const [profile, user] = await this.prisma.$transaction([
      this.prisma.adminProfile.update({ where: { userId }, data: { walletAddress } }),
      this.prisma.user.update({ where: { id: userId }, data: { registrationStep: 3 }, include: { adminProfile: true } }),
    ]);
    return { profile, user };
  }

  async activateAdminWithMfa(userId: string, encryptedSecret: string): Promise<UserWithProfile> {
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        firstLogin: false,
        status: 'ACTIVE',
        registrationStep: 4,
        inviteToken: null,
        inviteTokenExpiry: null,
        adminProfile: { update: { mfaSecret: encryptedSecret } },
      },
      include: { adminProfile: true },
    });
  }

  async bumpTokenVersion(userId: string): Promise<void> {
    await this.prisma.user.update({ where: { id: userId }, data: { tokenVersion: { increment: 1 } } });
  }

  async consumeFaceChallenge(userId: string, challenge: string, now: Date): Promise<number> {
    const result = await this.prisma.user.updateMany({
      where: { id: userId, faceChallenge: challenge, faceChallengeExpiresAt: { gte: now } },
      data: { faceChallenge: null, faceChallengeExpiresAt: null },
    });
    return result.count;
  }

  async updateFaceFailure(userId: string, failedFaceAttempts: number, faceLockedUntil: Date | null): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { failedFaceAttempts, faceLockedUntil },
    });
  }

  async resetFaceFailures(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { failedFaceAttempts: 0, faceLockedUntil: null },
    });
  }

  async updateAutoLockMinutes(userId: string, minutes: number): Promise<UserWithProfile> {
    return this.prisma.user.update({
      where: { id: userId },
      data: { autoLockMinutes: minutes },
      include: { adminProfile: true },
    });
  }
}
