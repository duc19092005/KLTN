import { Injectable, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { ZkpService } from '../zkp/zkp.service';
import { BlockchainService } from '../blockchain/blockchain.service';
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

  async bootstrapFirstAdmin(username: string, email: string, superAdminSecret: string) {
    const envKey = process.env.SUPER_ADMIN_PRIVATE_KEY;
    if (!envKey || envKey === 'your_super_admin_private_key_here') {
      throw new ForbiddenException('SUPER_ADMIN_PRIVATE_KEY not configured in .env');
    }

    if (superAdminSecret !== envKey) {
      throw new ForbiddenException('Invalid Super Admin secret key');
    }

    const existingAdmin = await this.prisma.user.findFirst({ where: { role: 'ADMIN' } });
    if (existingAdmin) {
      throw new ForbiddenException('An Admin account already exists.');
    }

    const inviteToken = crypto.randomBytes(32).toString('hex');
    const inviteTokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const user = await this.prisma.user.create({
      data: {
        username,
        email,
        role: 'ADMIN',
        status: 'PENDING',
        firstLogin: true,
        registrationStep: 1,
        inviteToken,
        inviteTokenExpiry,
        adminProfile: { create: { adminUserName: username } },
      },
    });

    return {
      message: 'First Admin account created successfully.',
      user: { id: user.id, username: user.username, email: user.email, role: user.role },
      inviteToken,
      flow: ['invite-login', 'register-face', 'verify-wallet', 'generate-secret', 'wallet-login', 'verify-face'],
    };
  }

  async loginWithInviteToken(inviteToken: string) {
    const user = await this.prisma.user.findUnique({
      where: { inviteToken },
      include: { adminProfile: true },
    });

    if (!user) throw new UnauthorizedException('Invalid invite token');
    if (user.role !== 'ADMIN') throw new UnauthorizedException('Invite token is not for Admin');
    if (!user.firstLogin) throw new UnauthorizedException('Invite token already used');
    if (user.inviteTokenExpiry && user.inviteTokenExpiry < new Date()) {
      throw new UnauthorizedException('Invite token has expired');
    }

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
        hasFace: Boolean(user.adminProfile?.faceEmbedding),
        hasWallet: Boolean(user.adminProfile?.walletAddress),
      },
    };
  }

  async registerFace(userId: string, embedding: number[]) {
    const descriptor = this.validateFaceDescriptor(embedding);

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { adminProfile: true },
    });
    if (!user || user.role !== 'ADMIN' || !user.adminProfile) {
      throw new UnauthorizedException('Admin not found');
    }

    const faceEmbedding = JSON.stringify(descriptor);
    const faceHash = crypto.createHash('sha256').update(faceEmbedding).digest('hex');

    await this.prisma.adminProfile.update({
      where: { userId },
      data: { faceEmbedding, faceHash },
    });
    await this.prisma.user.update({
      where: { id: userId },
      data: { registrationStep: Math.max(user.registrationStep ?? 1, 2) },
    });

    return {
      registered: true,
      algorithm: 'face-api/tiny-face-detector+landmark68tiny+recognition-128d',
      descriptorLength: descriptor.length,
      faceHash,
      registrationStep: 2,
    };
  }

  async verifyWallet(userId: string, address: string, signature: string, message: string) {
    const recovered = ethers.verifyMessage(message, signature);
    if (recovered.toLowerCase() !== address.toLowerCase()) {
      throw new UnauthorizedException('Invalid wallet signature');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { adminProfile: true },
    });
    if (!user || user.role !== 'ADMIN' || !user.adminProfile) {
      throw new UnauthorizedException('Admin not found');
    }
    if (!user.adminProfile.faceEmbedding) {
      throw new UnauthorizedException('Please register face before binding wallet');
    }

    if (
      user.adminProfile.walletAddress &&
      user.adminProfile.walletAddress.toLowerCase() !== address.toLowerCase()
    ) {
      throw new UnauthorizedException('Wallet address does not match registered address');
    }

    const chainResult = await this.blockchainService.authorizeAdmin(address);
    if (!chainResult.success) {
      throw new UnauthorizedException(chainResult.error || 'Failed to authorize wallet on-chain');
    }

    await this.prisma.adminProfile.update({
      where: { userId },
      data: { walletAddress: address },
    });
    await this.prisma.user.update({
      where: { id: userId },
      data: { registrationStep: 3 },
    });

    const payload = {
      sub: user.id,
      username: user.username,
      role: user.role,
      verified: false,
      isFirstLogin: true,
      walletAddress: address,
    };

    return {
      access_token: this.jwtService.sign(payload),
      verified: true,
      onChain: chainResult,
      registrationStep: 3,
    };
  }

  async walletChallenge(walletAddress: string) {
    const adminProfile = await this.prisma.adminProfile.findFirst({
      where: { walletAddress: { equals: walletAddress, mode: 'insensitive' } },
      include: { user: true },
    });

    if (!adminProfile) throw new UnauthorizedException('Wallet address not registered');
    if (adminProfile.user.status === 'SUSPENDED') throw new UnauthorizedException('Account suspended');

    const isOnChainAuthorized = await this.blockchainService.isAuthorized(walletAddress);
    if (!isOnChainAuthorized) {
      throw new UnauthorizedException('Wallet not authorized on blockchain.');
    }

    const nonce = `ZKP-Auth-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    await this.prisma.adminProfile.update({
      where: { id: adminProfile.id },
      data: { nonce },
    });

    return { nonce, message: `Sign this message to authenticate:\n${nonce}` };
  }

  async walletLogin(walletAddress: string, signature: string, message: string) {
    const adminProfile = await this.prisma.adminProfile.findFirst({
      where: { walletAddress: { equals: walletAddress, mode: 'insensitive' } },
      include: { user: true },
    });

    if (!adminProfile) throw new UnauthorizedException('Wallet not registered');
    if (!adminProfile.nonce || !message.includes(adminProfile.nonce)) {
      throw new UnauthorizedException('Invalid or expired nonce');
    }

    const isOnChainAuthorized = await this.blockchainService.isAuthorized(walletAddress);
    if (!isOnChainAuthorized) {
      throw new UnauthorizedException('Wallet not authorized on blockchain.');
    }

    const recovered = ethers.verifyMessage(message, signature);
    if (recovered.toLowerCase() !== walletAddress.toLowerCase()) {
      throw new UnauthorizedException('Invalid wallet signature');
    }

    await this.prisma.adminProfile.update({
      where: { id: adminProfile.id },
      data: { nonce: null },
    });

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
        hasFace: Boolean(adminProfile.faceEmbedding),
      },
    };
  }

  async verifyFace(userId: string, embedding: number[]) {
    const descriptor = this.validateFaceDescriptor(embedding);
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { adminProfile: true },
    });
    if (!user || !user.adminProfile?.faceEmbedding) {
      throw new UnauthorizedException('No face data registered');
    }

    const stored = this.validateFaceDescriptor(JSON.parse(user.adminProfile.faceEmbedding));
    const distance = this.euclideanDistance(descriptor, stored);
    const threshold = Number(process.env.FACE_MATCH_THRESHOLD ?? 0.6);
    if (distance > threshold) {
      throw new UnauthorizedException(`Face verification failed (distance: ${distance.toFixed(3)}, threshold: ${threshold})`);
    }

    const payload = {
      sub: user.id,
      username: user.username,
      role: user.role,
      verified: true,
      walletAddress: user.adminProfile.walletAddress,
    };

    return {
      access_token: this.jwtService.sign(payload),
      verified: true,
      algorithm: 'face-api/euclidean-distance',
      distance,
      threshold,
    };
  }

  async generateMfaSecret(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { adminProfile: true },
    });
    if (!user || user.role !== 'ADMIN' || !user.adminProfile) {
      throw new UnauthorizedException('Admin not found');
    }
    if (!user.adminProfile.walletAddress) {
      throw new UnauthorizedException('Please bind wallet before generating recovery secret');
    }

    if (user.adminProfile.mfaSecret) {
      return { secret: this.zkpService.decryptSecret(user.adminProfile.mfaSecret) };
    }

    const secret = this.zkpService.generateSecret();
    const encrypted = this.zkpService.encryptSecret(secret);

    await this.prisma.adminProfile.update({
      where: { userId },
      data: { mfaSecret: encrypted },
    });
    await this.prisma.user.update({
      where: { id: userId },
      data: { firstLogin: false, status: 'ACTIVE', registrationStep: 4, inviteToken: null, inviteTokenExpiry: null },
    });

    return { secret, activated: true, registrationStep: 4 };
  }

  async getMe(userId: string, verified: boolean) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { adminProfile: true },
    });
    if (!user) throw new UnauthorizedException('User not found');

    return {
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        verified,
        firstLogin: user.firstLogin,
        registrationStep: user.registrationStep,
        walletAddress: user.adminProfile?.walletAddress,
        hasFace: Boolean(user.adminProfile?.faceEmbedding),
      },
    };
  }

  private validateFaceDescriptor(embedding: unknown): number[] {
    if (!Array.isArray(embedding) || embedding.length !== 128) {
      throw new UnauthorizedException('Invalid face descriptor. Expected 128D face-api descriptor.');
    }

    return embedding.map((value) => {
      const numberValue = Number(value);
      if (!Number.isFinite(numberValue)) {
        throw new UnauthorizedException('Invalid face descriptor value');
      }
      return Number(numberValue.toFixed(6));
    });
  }

  private euclideanDistance(a: number[], b: number[]): number {
    if (a.length !== b.length) return Number.POSITIVE_INFINITY;
    let sum = 0;
    for (let i = 0; i < a.length; i++) {
      const diff = a[i] - b[i];
      sum += diff * diff;
    }
    return Math.sqrt(sum);
  }
}
