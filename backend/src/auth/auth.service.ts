import { Injectable, UnauthorizedException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { ZkpService } from '../zkp/zkp.service';
import { BlockchainService } from '../blockchain/blockchain.service';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { ethers } from 'ethers';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private zkpService: ZkpService,
    private blockchainService: BlockchainService,
  ) {}

  // ============================================================
  // ADMIN FLOW A: First-time login using invite token (no password)
  // ============================================================
  async loginWithInviteToken(inviteToken: string) {
    const user = await this.prisma.user.findUnique({
      where: { inviteToken },
      include: { adminProfile: true },
    });

    if (!user) throw new UnauthorizedException('Invalid invite token');
    if (user.role !== 'ADMIN') throw new UnauthorizedException('Invite token is not for Admin');
    if (!user.firstLogin) throw new UnauthorizedException('Invite token already used');

    // Check expiry
    if (user.inviteTokenExpiry && user.inviteTokenExpiry < new Date()) {
      throw new UnauthorizedException('Invite token has expired');
    }

    // Issue partial JWT for registration flow
    const payload = {
      sub: user.id,
      username: user.username,
      role: user.role,
      verified: false,
      isFirstLogin: true,
    };

    return {
      access_token: this.jwtService.sign(payload),
      firstLogin: true,
      requireRegistration: true,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        email: user.email,
        status: user.status,
        registrationStep: user.registrationStep,
        hasWallet: !!user.adminProfile?.walletAddress,
        hasFace: !!user.adminProfile?.faceEmbedding,
      },
    };
  }

  // ============================================================
  // ADMIN FLOW B: Subsequent login using Wallet (no password)
  // ============================================================

  /**
   * Step 1: Generate a challenge nonce for wallet authentication
   */
  async walletChallenge(walletAddress: string) {
    const adminProfile = await this.prisma.adminProfile.findFirst({
      where: { 
        walletAddress: { equals: walletAddress, mode: 'insensitive' }
      },
      include: { user: true },
    });

    if (!adminProfile) {
      throw new UnauthorizedException('Wallet address not registered');
    }

    if (adminProfile.user.status === 'SUSPENDED') {
      throw new UnauthorizedException('Account suspended');
    }

    // ANTI-HACKER: Verify wallet is authorized ON-CHAIN
    const isOnChainAuthorized = await this.blockchainService.isAuthorized(walletAddress);
    if (!isOnChainAuthorized) {
      throw new UnauthorizedException(
        'Wallet not authorized on blockchain. Possible DB tampering detected.',
      );
    }

    // Generate a unique nonce for this login session
    const nonce = `ZKP-Auth-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    await this.prisma.adminProfile.update({
      where: { id: adminProfile.id },
      data: { nonce },
    });

    return {
      nonce,
      message: `Sign this message to authenticate:\n${nonce}`,
    };
  }

  /**
   * Step 2: Verify wallet signature and issue partial JWT
   */
  async walletLogin(walletAddress: string, signature: string, message: string) {
    const adminProfile = await this.prisma.adminProfile.findFirst({
      where: { 
        walletAddress: { equals: walletAddress, mode: 'insensitive' }
      },
      include: { user: true },
    });

    if (!adminProfile) throw new UnauthorizedException('Wallet not registered');

    // Verify the nonce matches (prevents replay attacks)
    if (!adminProfile.nonce || !message.includes(adminProfile.nonce)) {
      throw new UnauthorizedException('Invalid or expired nonce');
    }

    // ANTI-HACKER: Double-check on-chain authorization
    const isOnChainAuthorized = await this.blockchainService.isAuthorized(walletAddress);
    if (!isOnChainAuthorized) {
      throw new UnauthorizedException(
        'Wallet not authorized on blockchain. Possible DB tampering detected.',
      );
    }

    // Verify EIP-191 signature
    const recovered = ethers.verifyMessage(message, signature);
    if (recovered.toLowerCase() !== walletAddress.toLowerCase()) {
      throw new UnauthorizedException('Invalid wallet signature');
    }

    // Clear nonce after use (single-use)
    await this.prisma.adminProfile.update({
      where: { id: adminProfile.id }, // Use ID instead of walletAddress since findUnique requires unique field
      data: { nonce: null },
    });

    // Issue partial JWT (Layer 1 passed, still needs face verification)
    const payload = {
      sub: adminProfile.user.id,
      username: adminProfile.adminUserName,
      role: 'ADMIN',
      verified: false,
      walletAddress,
    };

    return {
      access_token: this.jwtService.sign(payload),
      requireVerification: true,
      user: {
        id: adminProfile.user.id,
        username: adminProfile.adminUserName,
        role: 'ADMIN',
        email: adminProfile.user.email,
        status: adminProfile.user.status,
        walletAddress,
        hasFace: !!adminProfile.faceEmbedding,
      },
    };
  }

  // ============================================================
  // DOCTOR FLOW: Traditional username/password login
  // ============================================================
  async login(username: string, password: string) {
    // Tìm kiếm user bằng cả username hoặc email
    const user = await this.prisma.user.findFirst({
      where: {
        OR: [{ username }, { email: username }],
      },
      include: { doctorProfile: true },
    });
    if (!user) throw new UnauthorizedException('Invalid credentials');

    // Admin CANNOT use password login
    if (user.role === 'ADMIN') {
      throw new UnauthorizedException(
        'Admin accounts use wallet authentication. Please use "Connect Wallet" to login.',
      );
    }

    if (!user.password) throw new UnauthorizedException('No password set for this account');

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) throw new UnauthorizedException('Invalid credentials');

    if (user.status === 'SUSPENDED') {
      throw new UnauthorizedException('Account suspended');
    }

    // Issue partial JWT (Layer 1 only, still needs face verification for Doctor)
    const payload = {
      sub: user.id,
      username: user.username,
      role: user.role,
      verified: false,
    };

    return {
      access_token: this.jwtService.sign(payload),
      firstLogin: user.firstLogin,
      requireVerification: true,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        email: user.email,
        status: user.status,
        hasFace: !!user.doctorProfile?.faceEmbedding,
        registrationStep: user.registrationStep,
      },
    };
  }

  // ============================================================
  // SHARED: Face verification (Admin reads AdminProfile, Doctor reads DoctorProfile)
  // ============================================================
  async verifyFace(userId: string, embedding: number[]) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { adminProfile: true, doctorProfile: true },
    });
    if (!user) throw new UnauthorizedException('User not found');

    let storedEmbedding: string | null = null;

    if (user.role === 'ADMIN' && user.adminProfile) {
      storedEmbedding = user.adminProfile.faceEmbedding;
    } else if (user.doctorProfile) {
      storedEmbedding = user.doctorProfile.faceEmbedding;
    }

    if (!storedEmbedding) {
      throw new UnauthorizedException('No face data registered');
    }

    const stored: number[] = JSON.parse(storedEmbedding);
    const similarity = this.cosineSimilarity(embedding, stored);

    if (similarity < 0.92) {
      throw new UnauthorizedException(`Face verification failed (similarity: ${similarity.toFixed(3)})`);
    }

    // Issue full-access JWT (Layer 2 passed)
    const payload = {
      sub: user.id,
      username: user.username,
      role: user.role,
      verified: true,
      walletAddress: user.adminProfile?.walletAddress,
    };

    return {
      access_token: this.jwtService.sign(payload),
      verified: true,
      similarity,
    };
  }

  // ============================================================
  // DOCTOR: Change password (only for Doctor, not Admin)
  // ============================================================
  async changePassword(userId: string, oldPassword: string, newPassword: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('User not found');

    if (user.role === 'ADMIN') {
      throw new BadRequestException('Admin accounts do not use passwords');
    }

    if (!user.password) throw new BadRequestException('No password set');

    const isValid = await bcrypt.compare(oldPassword, user.password);
    if (!isValid) throw new BadRequestException('Old password is incorrect');

    const hashed = await bcrypt.hash(newPassword, 10);
    await this.prisma.user.update({
      where: { id: userId },
      // Also advance registrationStep so re-login after partial setup resumes at face scan
      data: { password: hashed, registrationStep: Math.max(user.registrationStep ?? 1, 2) },
    });

    return { message: 'Password changed successfully' };
  }

  // ============================================================
  // ADMIN: Verify wallet for registration flow (Step 3 of first-time setup)
  // ============================================================
  async verifyWallet(userId: string, address: string, signature: string, message: string) {
    const recovered = ethers.verifyMessage(message, signature);
    if (recovered.toLowerCase() !== address.toLowerCase()) {
      throw new UnauthorizedException('Invalid wallet signature');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { adminProfile: true },
    });
    if (!user) throw new UnauthorizedException('User not found');

    // For Admin: check against AdminProfile
    if (user.role === 'ADMIN' && user.adminProfile) {
      if (user.adminProfile.walletAddress && 
          user.adminProfile.walletAddress.toLowerCase() !== address.toLowerCase()) {
        throw new UnauthorizedException('Wallet address does not match registered address');
      }
    }

    const payload = {
      sub: user.id,
      username: user.username,
      role: user.role,
      verified: true,
      walletAddress: address,
    };

    return {
      access_token: this.jwtService.sign(payload),
      verified: true,
    };
  }

  // ============================================================
  // ADMIN: Generate MFA secret for account recovery
  // ============================================================
  async generateMfaSecret(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { adminProfile: true },
    });
    if (!user || !user.adminProfile) throw new UnauthorizedException('Admin not found');

    // If already has MFA secret, decrypt and return (idempotent for first-time setup)
    if (user.adminProfile.mfaSecret) {
      try {
        const existingSecret = this.zkpService.decryptSecret(user.adminProfile.mfaSecret);
        return { secret: existingSecret };
      } catch {
        // If decryption fails, generate a new one
      }
    }

    // Generate new MFA recovery secret
    const secret = this.zkpService.generateSecret();
    const encrypted = this.zkpService.encryptSecret(secret);

    await this.prisma.adminProfile.update({
      where: { userId },
      data: { mfaSecret: encrypted },
    });

    return { secret };
  }

  // ============================================================
  // BOOTSTRAP: Create first Admin account (one-time use)
  // Only works when ZERO admin accounts exist in the system
  // ============================================================
  async bootstrapFirstAdmin(username: string, email: string, superAdminSecret: string) {
    // Verify the super admin secret matches the env key
    const envKey = process.env.SUPER_ADMIN_PRIVATE_KEY;
    if (!envKey || envKey === 'your_super_admin_private_key_here') {
      throw new ForbiddenException('SUPER_ADMIN_PRIVATE_KEY not configured in .env');
    }

    if (superAdminSecret !== envKey) {
      throw new ForbiddenException('Invalid Super Admin secret key');
    }

    // Check if any Admin already exists
    const existingAdmin = await this.prisma.user.findFirst({
      where: { role: 'ADMIN' },
    });
    if (existingAdmin) {
      throw new ForbiddenException(
        'An Admin account already exists. Use the Admin dashboard to create more admins.',
      );
    }

    // Create the first Admin with invite token
    const inviteToken = crypto.randomBytes(32).toString('hex');
    const inviteTokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    const user = await this.prisma.user.create({
      data: {
        username,
        email,
        password: null,
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
    });

    return {
      message: 'First Admin account created successfully!',
      user: { id: user.id, username: user.username, email: user.email, role: user.role },
      inviteToken,
      instructions: 'Use this invite token on the Login page → Admin tab → "Invite Code" to complete registration.',
    };
  }

  // ============================================================
  // SHARED: Wallet Recovery initialization (Public)
  // ============================================================
  async recoverInit(embedding: number[]) {
    // Fetch all admins with a registered face embedding
    const admins = await this.prisma.user.findMany({
      where: {
        role: 'ADMIN',
        adminProfile: {
          faceEmbedding: { not: null },
        },
      },
      include: { adminProfile: true },
    });

    let matchedUser = null;
    let highestSimilarity = 0;

    for (const user of admins) {
      if (!user.adminProfile?.faceEmbedding) continue;
      try {
        const stored: number[] = JSON.parse(user.adminProfile.faceEmbedding);
        const similarity = this.cosineSimilarity(embedding, stored);
        if (similarity > highestSimilarity) {
          highestSimilarity = similarity;
          matchedUser = user;
        }
      } catch (err) {
        // Skip malformed profiles
      }
    }

    // Check strict threshold
    if (!matchedUser || highestSimilarity < 0.92) {
      throw new UnauthorizedException(
        'Không nhận diện được khuôn mặt Admin phù hợp trong cơ sở dữ liệu.'
      );
    }

    // Issue temporary token for ZKP recovery page
    const payload = {
      sub: matchedUser.id,
      username: matchedUser.username,
      role: matchedUser.role,
      verified: false,
      isRecovery: true,
    };

    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: matchedUser.id,
        username: matchedUser.username,
        role: matchedUser.role,
      }
    };
  }

  // ============================================================
  // DOCTOR: Password Recovery initialization (Public)
  // ============================================================
  async doctorRecoverInit(embedding: number[]) {
    // Fetch all doctors with a registered face embedding
    const doctors = await this.prisma.user.findMany({
      where: {
        role: 'DOCTOR',
        doctorProfile: {
          faceEmbedding: { not: null },
        },
      },
      include: { doctorProfile: true },
    });

    let matchedUser = null;
    let highestSimilarity = 0;

    for (const user of doctors) {
      if (!user.doctorProfile?.faceEmbedding) continue;
      try {
        const stored: number[] = JSON.parse(user.doctorProfile.faceEmbedding);
        const similarity = this.cosineSimilarity(embedding, stored);
        if (similarity > highestSimilarity) {
          highestSimilarity = similarity;
          matchedUser = user;
        }
      } catch (err) {
        // Skip malformed profiles
      }
    }

    // Check strict threshold
    if (!matchedUser || highestSimilarity < 0.92) {
      throw new UnauthorizedException(
        'Không nhận diện được khuôn mặt Bác sĩ phù hợp trong cơ sở dữ liệu.'
      );
    }

    // Issue temporary token for password reset
    const payload = {
      sub: matchedUser.id,
      username: matchedUser.username,
      role: matchedUser.role,
      verified: false,
      canResetPassword: true,
    };

    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: matchedUser.id,
        username: matchedUser.username,
        role: matchedUser.role,
      }
    };
  }

  // ============================================================
  // DOCTOR: Reset Password (JWT protected)
  // ============================================================
  async resetPassword(userId: string, newPassword: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const hashed = await bcrypt.hash(newPassword, 10);
    await this.prisma.user.update({
      where: { id: userId },
      data: { password: hashed, firstLogin: false }, // Resetting password counts as setting up password, make firstLogin false just in case
    });

    return { message: 'Mật khẩu đã được cập nhật thành công.' };
  }

  async getMe(userId: string, verified: boolean) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    return {
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        verified: verified,
        firstLogin: user.firstLogin,
      }
    };
  }

  // ============================================================
  // Private helpers
  // ============================================================
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;
    let dot = 0, normA = 0, normB = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    if (normA === 0 || normB === 0) return 0;
    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
  }
}
