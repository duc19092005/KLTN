import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

@Injectable()
export class UserService {
  constructor(private prisma: PrismaService) {}

  /**
   * Admin creates a new user
   * - For ADMIN role: generates invite token (no password)
   * - For DOCTOR role: generates temporary password
   */
  async createUser(username: string, email: string, role: string = 'DOCTOR') {
    // Check if username or email already exists
    const existing = await this.prisma.user.findFirst({
      where: { OR: [{ username }, { email }] },
    });
    if (existing) throw new ConflictException('Username or email already exists');

    if (role === 'ADMIN') {
      return this.createAdminUser(username, email);
    } else {
      throw new ConflictException('Only Admin role is supported');
    }
  }

  /**
   * Create Admin user with invite token (NO password)
   */
  private async createAdminUser(username: string, email: string) {
    // Generate a secure invite token (64 hex characters)
    const inviteToken = crypto.randomBytes(32).toString('hex');
    const inviteTokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    const user = await this.prisma.user.create({
      data: {
        username,
        email,
        password: null, // Admin NEVER has a password
        role: 'ADMIN',
        status: 'PENDING',
        firstLogin: true,
        registrationStep: 1,
        inviteToken,
        inviteTokenExpiry,
        adminProfile: {
          create: {
            adminUserName: username,
          },
        },
      },
      include: { adminProfile: true },
    });

    return {
      user: { id: user.id, username: user.username, email: user.email, role: user.role },
      inviteToken, // Send this via email instead of password
    };
  }



  async findById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { adminProfile: true },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async findByUsername(username: string) {
    return this.prisma.user.findUnique({ where: { username } });
  }

  /**
   * Update wallet address for Admin (stored in AdminProfile)
   */
  async updateWalletAddress(userId: string, walletAddress: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { adminProfile: true },
    });

    if (!user) throw new NotFoundException('User not found');

    if (user.role === 'ADMIN' && user.adminProfile) {
      await this.prisma.adminProfile.update({
        where: { userId },
        data: { walletAddress },
      });
      // Also update user registration step
      return this.prisma.user.update({
        where: { id: userId },
        data: { status: 'ACTIVE', registrationStep: 3 },
      });
    }

    throw new Error('Only Admin users have wallet addresses');
  }

  /**
   * Update face data (Admin → AdminProfile, Doctor → DoctorProfile)
   */
  async updateFaceData(userId: string, faceEmbedding: string, faceHash: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { adminProfile: true },
    });
    if (!user) throw new NotFoundException('User not found');

    if (user.role === 'ADMIN' && user.adminProfile) {
      await this.prisma.adminProfile.update({
        where: { userId },
        data: { faceEmbedding, faceHash },
      });
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: { registrationStep: 2 },
    });
  }

  /**
   * Update ZKP data for Admin (stored in AdminProfile)
   */
  async updateZkpData(userId: string, zkpSecret: string, zkpCommitment: string) {
    return this.prisma.adminProfile.update({
      where: { userId },
      data: { zkpSecret, zkpCommitment },
    });
  }

  async getAllUsers() {
    return this.prisma.user.findMany({
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        status: true,
        firstLogin: true,
        createdAt: true,
        adminProfile: {
          select: { walletAddress: true },
        },
      },
    });
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { adminProfile: true },
    });
    if (!user) throw new NotFoundException('User not found');

    const baseProfile = {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      status: user.status,
      firstLogin: user.firstLogin,
      registrationStep: user.registrationStep,
      createdAt: user.createdAt,
    };

    if (user.role === 'ADMIN' && user.adminProfile) {
      return {
        ...baseProfile,
        walletAddress: user.adminProfile.walletAddress,
        hasFace: !!user.adminProfile.faceEmbedding,
        hasWallet: !!user.adminProfile.walletAddress,
        hasZkp: !!user.adminProfile.zkpCommitment,
      };
    }

    return baseProfile;
  }

  /**
   * Rollback registration step
   * Admin steps: 1:face, 2:wallet, 3:zkp, 4:done
   * Doctor steps: 1:password, 2:face, 3:done
   */
  async rollbackStep(userId: string, currentStep: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { adminProfile: true },
    });
    if (!user) throw new NotFoundException('User not found');

    if (user.role === 'ADMIN' && user.adminProfile) {
      return this.rollbackAdminStep(userId, currentStep);
    }
    return this.prisma.user.findUnique({ where: { id: userId } });
  }

  private async rollbackAdminStep(userId: string, currentStep: number) {
    if (currentStep === 3) {
      // Rollback ZKP → wallet step
      await this.prisma.adminProfile.update({
        where: { userId },
        data: { zkpCommitment: null, zkpSecret: null },
      });
      return this.prisma.user.update({
        where: { id: userId },
        data: { registrationStep: 2 },
      });
    } else if (currentStep === 2) {
      // Rollback wallet → face step
      await this.prisma.adminProfile.update({
        where: { userId },
        data: { walletAddress: null },
      });
      return this.prisma.user.update({
        where: { id: userId },
        data: { registrationStep: 1, status: 'PENDING' },
      });
    } else if (currentStep === 1) {
      // Rollback face → start (clear face data)
      await this.prisma.adminProfile.update({
        where: { userId },
        data: { faceEmbedding: null, faceHash: null },
      });
      return this.prisma.user.update({
        where: { id: userId },
        data: { registrationStep: 1 },
      });
    }
    return this.prisma.user.findUnique({ where: { id: userId } });
  }


}
