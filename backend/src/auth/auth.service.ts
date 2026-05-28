import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AdminProfile, User } from '@prisma/client';
import * as crypto from 'crypto';
import { ethers } from 'ethers';
import { BlockchainService } from '../blockchain/blockchain.service';
import { PrismaService } from '../prisma/prisma.service';
import { ZkpService } from '../zkp/zkp.service';

type UserWithProfile = User & { adminProfile: AdminProfile | null };

const INVITE_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
const WALLET_NONCE_TTL_MS = 5 * 60 * 1000;
const WALLET_PURPOSE_BIND = 'BIND_ADMIN_WALLET';
const WALLET_PURPOSE_LOGIN = 'WALLET_LOGIN';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private zkpService: ZkpService,
    private blockchainService: BlockchainService,
  ) {}

  async bootstrapFirstAdmin(username: string, email: string, superAdminSecret: string) {
    const bootstrapSecret = process.env.BOOTSTRAP_ADMIN_SECRET || process.env.SUPER_ADMIN_PRIVATE_KEY;
    if (!bootstrapSecret || bootstrapSecret === 'your_super_admin_private_key_here') {
      throw new ForbiddenException('BOOTSTRAP_ADMIN_SECRET or SUPER_ADMIN_PRIVATE_KEY is not configured');
    }

    if (!this.timingSafeEquals(superAdminSecret, bootstrapSecret)) {
      throw new ForbiddenException('Invalid bootstrap secret');
    }

    const existingAdmin = await this.prisma.user.findFirst({ where: { role: 'ADMIN' } });
    if (existingAdmin) {
      throw new ForbiddenException('An Admin account already exists.');
    }

    const rawInviteToken = crypto.randomBytes(32).toString('hex');
    const inviteTokenExpiry = new Date(Date.now() + INVITE_TOKEN_TTL_MS);

    const user = await this.prisma.user.create({
      data: {
        username: username.trim(),
        email: email.trim().toLowerCase(),
        role: 'ADMIN',
        status: 'PENDING',
        firstLogin: true,
        registrationStep: 1,
        inviteToken: this.hashInviteToken(rawInviteToken),
        inviteTokenExpiry,
        adminProfile: { create: { adminUserName: username.trim() } },
      },
    });

    return {
      message: 'First Admin account created successfully.',
      user: { id: user.id, username: user.username, email: user.email, role: user.role },
      inviteToken: rawInviteToken,
      inviteTokenExpiresAt: inviteTokenExpiry.toISOString(),
      flow: ['invite-login', 'register-face', 'verify-wallet', 'generate-secret', 'wallet-login', 'verify-face'],
    };
  }

  async loginWithInviteToken(inviteToken: string) {
    const trimmedToken = inviteToken.trim();
    const tokenHash = this.hashInviteToken(trimmedToken);
    const user = await this.prisma.user.findFirst({
      where: { inviteToken: { in: [tokenHash, trimmedToken] } },
      include: { adminProfile: true },
    });

    if (!user) throw new UnauthorizedException('Invalid invite token');
    if (user.role !== 'ADMIN') throw new UnauthorizedException('Invite token is not for Admin');
    if (!user.firstLogin) throw new UnauthorizedException('Invite token already used');
    if (user.inviteTokenExpiry && user.inviteTokenExpiry < new Date()) {
      throw new UnauthorizedException('Invite token has expired');
    }

    if (user.inviteToken !== tokenHash) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { inviteToken: tokenHash },
      });
    }

    return {
      access_token: this.signAccessToken(user, {
        verified: false,
        isFirstLogin: true,
      }),
      firstLogin: true,
      requireRegistration: true,
      user: this.toPublicUser(user, false),
    };
  }

  async registerFace(userId: string, embedding: number[] | number[][]) {
    const descriptors = this.validateFaceDescriptorSet(embedding);
    const user = await this.getAdminUser(userId);

    if (!user.firstLogin && user.adminProfile?.faceEmbedding) {
      throw new ForbiddenException('Face data is already registered');
    }

    const faceEmbeddingJson = JSON.stringify(descriptors);
    const faceHash = crypto.createHash('sha256').update(faceEmbeddingJson).digest('hex');
    const encryptedFaceEmbedding = this.zkpService.encryptSecret(faceEmbeddingJson);

    await this.prisma.$transaction([
      this.prisma.adminProfile.update({
        where: { userId },
        data: { faceEmbedding: encryptedFaceEmbedding, faceHash },
      }),
      this.prisma.user.update({
        where: { id: userId },
        data: { registrationStep: Math.max(user.registrationStep ?? 1, 2) },
      }),
    ]);

    return {
      registered: true,
      algorithm: 'face-api/tiny-face-detector+landmark68tiny+recognition-128d/multi-sample',
      descriptorLength: descriptors[0].length,
      descriptorCount: descriptors.length,
      registrationStep: 2,
    };
  }

  async walletBindChallenge(userId: string, address: string) {
    const walletAddress = this.normalizeWalletAddress(address);
    const user = await this.getAdminUser(userId);

    if (!user.firstLogin) {
      throw new ForbiddenException('Wallet binding is only available during first admin setup');
    }
    if (!user.adminProfile?.faceEmbedding) {
      throw new UnauthorizedException('Please register face before binding wallet');
    }
    if (
      user.adminProfile.walletAddress &&
      user.adminProfile.walletAddress.toLowerCase() !== walletAddress.toLowerCase()
    ) {
      throw new UnauthorizedException('Wallet address does not match registered address');
    }

    const existingWallet = await this.prisma.adminProfile.findFirst({
      where: {
        walletAddress: { equals: walletAddress, mode: 'insensitive' },
        userId: { not: userId },
      },
    });
    if (existingWallet) {
      throw new UnauthorizedException('Wallet is already bound to another admin');
    }

    return this.createWalletChallenge(user.adminProfile.id, walletAddress, WALLET_PURPOSE_BIND, user.id);
  }

  async verifyWallet(userId: string, address: string, signature: string, message: string) {
    const walletAddress = this.normalizeWalletAddress(address);
    const user = await this.getAdminUser(userId);

    if (!user.firstLogin) {
      throw new ForbiddenException('Wallet binding is only available during first admin setup');
    }
    if (!user.adminProfile?.faceEmbedding) {
      throw new UnauthorizedException('Please register face before binding wallet');
    }
    if (
      user.adminProfile.walletAddress &&
      user.adminProfile.walletAddress.toLowerCase() !== walletAddress.toLowerCase()
    ) {
      throw new UnauthorizedException('Wallet address does not match registered address');
    }

    await this.consumeWalletChallenge(
      user.adminProfile,
      walletAddress,
      signature,
      message,
      WALLET_PURPOSE_BIND,
      user.id,
    );

    const chainResult = await this.blockchainService.authorizeAdmin(walletAddress);
    if (!chainResult.success) {
      throw new UnauthorizedException(chainResult.error || 'Failed to authorize wallet on-chain');
    }

    const [updatedProfile, updatedUser] = await this.prisma.$transaction([
      this.prisma.adminProfile.update({
        where: { userId },
        data: { walletAddress },
      }),
      this.prisma.user.update({
        where: { id: userId },
        data: { registrationStep: 3 },
        include: { adminProfile: true },
      }),
    ]);

    return {
      access_token: this.signAccessToken(updatedUser, {
        verified: false,
        isFirstLogin: true,
        walletAddress,
      }),
      verified: false,
      onChain: chainResult,
      registrationStep: 3,
      user: this.toPublicUser({ ...updatedUser, adminProfile: updatedProfile }, false),
    };
  }

  async walletChallenge(walletAddress: string) {
    const normalizedWalletAddress = this.normalizeWalletAddress(walletAddress);
    const adminProfile = await this.prisma.adminProfile.findFirst({
      where: { walletAddress: { equals: normalizedWalletAddress, mode: 'insensitive' } },
      include: { user: true },
    });

    if (!adminProfile) throw new UnauthorizedException('Wallet address not registered');
    if (adminProfile.user.status !== 'ACTIVE' || adminProfile.user.firstLogin) {
      throw new UnauthorizedException('Admin setup is not complete');
    }
    if (!adminProfile.faceEmbedding) {
      throw new UnauthorizedException('Face data is not registered');
    }

    const isOnChainAuthorized = await this.blockchainService.isAuthorized(normalizedWalletAddress);
    if (!isOnChainAuthorized) {
      throw new UnauthorizedException('Wallet not authorized on blockchain.');
    }

    return this.createWalletChallenge(adminProfile.id, normalizedWalletAddress, WALLET_PURPOSE_LOGIN);
  }

  async walletLogin(walletAddress: string, signature: string, message: string) {
    const normalizedWalletAddress = this.normalizeWalletAddress(walletAddress);
    const adminProfile = await this.prisma.adminProfile.findFirst({
      where: { walletAddress: { equals: normalizedWalletAddress, mode: 'insensitive' } },
      include: { user: true },
    });

    if (!adminProfile) throw new UnauthorizedException('Wallet not registered');
    if (adminProfile.user.status !== 'ACTIVE' || adminProfile.user.firstLogin) {
      throw new UnauthorizedException('Admin setup is not complete');
    }

    await this.consumeWalletChallenge(
      adminProfile,
      normalizedWalletAddress,
      signature,
      message,
      WALLET_PURPOSE_LOGIN,
    );

    const isOnChainAuthorized = await this.blockchainService.isAuthorized(normalizedWalletAddress);
    if (!isOnChainAuthorized) {
      throw new UnauthorizedException('Wallet not authorized on blockchain.');
    }

    return {
      access_token: this.signAccessToken(adminProfile.user, {
        verified: false,
        walletAddress: normalizedWalletAddress,
      }),
      requireVerification: true,
      user: this.toPublicUser(
        { ...adminProfile.user, adminProfile: { ...adminProfile, walletAddress: normalizedWalletAddress } },
        false,
      ),
    };
  }

  async verifyFace(userId: string, embedding: number[], tokenWalletAddress?: string) {
    if (!tokenWalletAddress) {
      throw new UnauthorizedException('Wallet authentication is required before face verification');
    }

    const descriptor = this.validateFaceDescriptor(embedding);
    const user = await this.getAdminUser(userId);

    if (user.status !== 'ACTIVE' || user.firstLogin) {
      throw new UnauthorizedException('Admin setup is not complete');
    }
    if (!user.adminProfile?.faceEmbedding || !user.adminProfile.walletAddress) {
      throw new UnauthorizedException('Face or wallet data is not registered');
    }
    if (user.adminProfile.walletAddress.toLowerCase() !== tokenWalletAddress.toLowerCase()) {
      throw new UnauthorizedException('Wallet session mismatch');
    }

    const storedDescriptors = this.decodeStoredDescriptors(user.adminProfile.faceEmbedding);
    const distances = storedDescriptors.map((stored) => this.euclideanDistance(descriptor, stored));
    const distance = Math.min(...distances);
    const threshold = this.getFaceMatchThreshold();

    console.log(`[FaceVerify] userId=${userId} distance=${distance.toFixed(4)} threshold=${threshold} result=${distance <= threshold ? 'PASS' : 'FAIL'}`);

    if (distance > threshold) {
      throw new UnauthorizedException('Face verification failed');
    }

    return {
      access_token: this.signAccessToken(user, {
        verified: true,
        walletAddress: user.adminProfile.walletAddress,
      }),
      verified: true,
      algorithm: 'face-api/euclidean-distance/min-of-multi-sample',
      matchedDescriptorCount: storedDescriptors.length,
      user: this.toPublicUser(user, true),
    };
  }

  async generateMfaSecret(userId: string) {
    const user = await this.getAdminUser(userId);

    if (!user.firstLogin) {
      throw new ForbiddenException('Recovery secret has already been generated');
    }
    if (!user.adminProfile?.faceEmbedding) {
      throw new UnauthorizedException('Please register face before generating recovery secret');
    }
    if (!user.adminProfile.walletAddress) {
      throw new UnauthorizedException('Please bind wallet before generating recovery secret');
    }
    if (user.adminProfile.mfaSecret) {
      throw new ForbiddenException('Recovery secret has already been generated');
    }

    const secret = this.zkpService.generateSecret();
    const encrypted = this.zkpService.encryptSecret(secret);

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: {
        firstLogin: false,
        status: 'ACTIVE',
        registrationStep: 4,
        inviteToken: null,
        inviteTokenExpiry: null,
        adminProfile: { update: { mfaSecret: encrypted } },
      },
      include: { adminProfile: true },
    });

    return {
      access_token: this.signAccessToken(updatedUser, {
        verified: true,
        walletAddress: updatedUser.adminProfile?.walletAddress,
      }),
      secret,
      activated: true,
      registrationStep: 4,
      user: this.toPublicUser(updatedUser, true),
    };
  }

  async getMe(userId: string, verified: boolean) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { adminProfile: true },
    });
    if (!user) throw new UnauthorizedException('User not found');

    const isVerified = Boolean(verified) && user.status === 'ACTIVE' && !user.firstLogin;
    return { user: this.toPublicUser(user, isVerified) };
  }

  async logout(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { tokenVersion: { increment: 1 } },
    });
  }

  async logoutToken(token?: string) {
    if (!token) return;

    try {
      const payload = this.jwtService.verify<{ sub?: string }>(token);
      if (payload.sub) {
        await this.logout(payload.sub);
      }
    } catch {
      // Expired or malformed tokens still get cleared from the browser by the controller.
    }
  }

  private async getAdminUser(userId: string): Promise<UserWithProfile> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { adminProfile: true },
    });

    if (!user || user.role !== 'ADMIN' || !user.adminProfile) {
      throw new UnauthorizedException('Admin not found');
    }
    if (user.status === 'SUSPENDED') {
      throw new UnauthorizedException('Account suspended');
    }

    return user;
  }

  private async createWalletChallenge(
    adminProfileId: string,
    walletAddress: string,
    purpose: string,
    userId?: string,
  ) {
    const nonce = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + WALLET_NONCE_TTL_MS);
    const message = this.buildWalletMessage(purpose, walletAddress, nonce, expiresAt, userId);

    await this.prisma.adminProfile.update({
      where: { id: adminProfileId },
      data: {
        nonce,
        noncePurpose: purpose,
        nonceExpiresAt: expiresAt,
      },
    });

    return {
      walletAddress,
      nonce,
      expiresAt: expiresAt.toISOString(),
      message,
    };
  }

  private async consumeWalletChallenge(
    adminProfile: AdminProfile,
    walletAddress: string,
    signature: string,
    message: string,
    purpose: string,
    userId?: string,
  ) {
    const now = new Date();
    if (
      !adminProfile.nonce ||
      !adminProfile.nonceExpiresAt ||
      adminProfile.nonceExpiresAt < now ||
      adminProfile.noncePurpose !== purpose
    ) {
      throw new UnauthorizedException('Invalid or expired wallet challenge');
    }

    const expectedMessage = this.buildWalletMessage(
      purpose,
      walletAddress,
      adminProfile.nonce,
      adminProfile.nonceExpiresAt,
      userId,
    );
    if (message !== expectedMessage) {
      throw new UnauthorizedException('Invalid wallet challenge message');
    }

    let recovered: string;
    try {
      recovered = ethers.verifyMessage(message, signature);
    } catch {
      throw new UnauthorizedException('Invalid wallet signature');
    }

    if (ethers.getAddress(recovered) !== walletAddress) {
      throw new UnauthorizedException('Invalid wallet signature');
    }

    const result = await this.prisma.adminProfile.updateMany({
      where: {
        id: adminProfile.id,
        nonce: adminProfile.nonce,
        noncePurpose: purpose,
        nonceExpiresAt: { gte: now },
      },
      data: {
        nonce: null,
        noncePurpose: null,
        nonceExpiresAt: null,
      },
    });

    if (result.count !== 1) {
      throw new UnauthorizedException('Wallet challenge has already been used');
    }
  }

  private buildWalletMessage(
    purpose: string,
    walletAddress: string,
    nonce: string,
    expiresAt: Date,
    userId?: string,
  ) {
    const lines = [
      `${process.env.AUTH_MESSAGE_DOMAIN || 'KLTN Admin Auth'} admin authentication`,
      `Purpose: ${purpose}`,
      `Wallet: ${walletAddress}`,
    ];

    if (userId) {
      lines.push(`Admin User ID: ${userId}`);
    }

    lines.push(`Nonce: ${nonce}`, `Expires At: ${expiresAt.toISOString()}`);
    return lines.join('\n');
  }

  private signAccessToken(
    user: Pick<User, 'id' | 'username' | 'role' | 'firstLogin' | 'tokenVersion'>,
    options: { verified: boolean; walletAddress?: string | null; isFirstLogin?: boolean },
  ) {
    return this.jwtService.sign({
      sub: user.id,
      username: user.username,
      role: user.role,
      verified: options.verified,
      isFirstLogin: options.isFirstLogin ?? user.firstLogin,
      walletAddress: options.walletAddress || undefined,
      tokenVersion: user.tokenVersion,
    });
  }

  private toPublicUser(user: UserWithProfile, verified: boolean) {
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
      hasFace: Boolean(user.adminProfile?.faceEmbedding),
      hasWallet: Boolean(user.adminProfile?.walletAddress),
    };
  }

  private normalizeWalletAddress(address: string): string {
    try {
      return ethers.getAddress(address);
    } catch {
      throw new BadRequestException('Invalid wallet address');
    }
  }

  private hashInviteToken(inviteToken: string): string {
    return `sha256:${crypto.createHash('sha256').update(inviteToken).digest('hex')}`;
  }

  private timingSafeEquals(leftValue: string, rightValue: string) {
    const left = crypto.createHash('sha256').update(leftValue).digest();
    const right = crypto.createHash('sha256').update(rightValue).digest();
    return crypto.timingSafeEqual(left, right);
  }

  private validateFaceDescriptor(embedding: unknown): number[] {
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

  private validateFaceDescriptorSet(embedding: unknown): number[][] {
    if (!Array.isArray(embedding)) {
      throw new BadRequestException('Invalid face descriptor payload.');
    }

    const candidates = Array.isArray(embedding[0]) ? embedding : [embedding];
    if (candidates.length < 3 || candidates.length > 15) {
      throw new BadRequestException('Expected 3 to 15 face descriptors for reliable enrollment.');
    }

    return candidates.map((candidate) => this.validateFaceDescriptor(candidate));
  }

  private decodeStoredDescriptors(faceEmbedding: string): number[][] {
    try {
      const plaintext = faceEmbedding.trim().startsWith('[')
        ? faceEmbedding
        : this.zkpService.decryptSecret(faceEmbedding);
      const parsed = JSON.parse(plaintext);
      return this.validateFaceDescriptorSet(parsed);
    } catch {
      throw new UnauthorizedException('Stored face descriptor is invalid');
    }
  }

  private getFaceMatchThreshold(): number {
    // face-api euclidean distance: <0.42 = same person, 0.42-0.5 = borderline, >0.5 = different person
    // Default 0.45 balances security vs usability; override via FACE_MATCH_THRESHOLD env var
    const threshold = Number(process.env.FACE_MATCH_THRESHOLD ?? 0.45);
    if (!Number.isFinite(threshold) || threshold <= 0 || threshold > 1) {
      return 0.45;
    }
    return threshold;
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
