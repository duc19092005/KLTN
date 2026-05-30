import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AdminProfile, User, UserRole } from '@prisma/client';
import * as crypto from 'crypto';
import { ethers } from 'ethers';
import { BlockchainService } from '../../../infrastructure/blockchain/blockchain.service';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { ZkpService } from '../../zkp/services/zkp.service';
import { hashToBytes32 } from '../../../infrastructure/audit/audit-hash.util';

type UserWithProfile = User & { adminProfile: AdminProfile | null };
type LoginableRole = Exclude<UserRole, 'ADMIN'>;

const INVITE_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
const WALLET_NONCE_TTL_MS = 5 * 60 * 1000;
const WALLET_PURPOSE_BIND = 'BIND_ADMIN_WALLET';
const WALLET_PURPOSE_LOGIN = 'WALLET_LOGIN';

// Biometric face verification
const FACE_CHALLENGE_TTL_MS = 2 * 60 * 1000;
const FACE_MODEL_VERSION = 'face-api/tiny-face-detector+landmark68tiny+recognition-128d';
const FACE_MAX_FAILED_ATTEMPTS = 5;
const FACE_LOCKOUT_MS = 15 * 60 * 1000;

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

  async loginWithPassword(usernameOrEmail: string, password: string) {
    const identity = usernameOrEmail.trim();
    const user = await this.prisma.user.findFirst({
      where: {
        OR: [
          { username: identity },
          { email: identity.toLowerCase() },
        ],
      },
      include: { adminProfile: true },
    });

    if (!user || user.role === 'ADMIN') throw new UnauthorizedException('Invalid credentials');
    if (user.status !== 'ACTIVE') throw new UnauthorizedException('Account is not active');
    if (!user.passwordHash || !this.verifyPassword(password, user.passwordHash)) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return {
      access_token: this.signAccessToken(user, { verified: false }),
      requirePasswordChange: user.firstLogin,
      requireFaceRegistration: user.firstLogin || !user.faceEmbedding,
      requireFaceVerification: Boolean(user.faceEmbedding),
      user: this.toPublicUser(user, false),
    };
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, include: { adminProfile: true } });
    if (!user) throw new UnauthorizedException('User not found');
    if (!user.passwordHash || !this.verifyPassword(currentPassword, user.passwordHash)) {
      throw new UnauthorizedException('Current password is incorrect');
    }
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: this.hashPassword(newPassword), firstLogin: false, registrationStep: Math.max(user.registrationStep ?? 1, 2) },
      include: { adminProfile: true },
    });
    return { passwordChanged: true, user: this.toPublicUser(updated, false) };
  }

  async registerFace(userId: string, embedding: number[] | number[][]) {
    const descriptors = this.validateFaceDescriptorSet(embedding);
    const user = await this.getAuthUser(userId);

    if (!user.firstLogin && user.faceEmbedding) {
      throw new ForbiddenException('Face data is already registered');
    }

    const faceEmbeddingJson = JSON.stringify(descriptors);
    const faceHash = this.computeFaceHash(descriptors);
    const encryptedFaceEmbedding = this.zkpService.encryptSecret(faceEmbeddingJson);

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        faceEmbedding: encryptedFaceEmbedding,
        faceHash,
        faceModelVersion: FACE_MODEL_VERSION,
        faceEnrolledAt: new Date(),
        faceSampleCount: descriptors.length,
        failedFaceAttempts: 0,
        faceLockedUntil: null,
        registrationStep: Math.max(user.registrationStep ?? 1, 2),
      },
    });

    // Anchor the face-template integrity hash on-chain (FaceRegistry). Non-fatal: if the
    // chain is unavailable the template is simply not yet protected by the integrity gate;
    // it can be re-anchored later. The login gate treats a missing anchor as "skip".
    const chainResult = await this.blockchainService.setFaceHash(userId, hashToBytes32(faceHash));

    await this.writeAudit(userId, 'FACE_ENROLL', 'User', userId, {
      sampleCount: descriptors.length,
      modelVersion: FACE_MODEL_VERSION,
      onChain: chainResult.success ? 'ANCHORED' : 'UNANCHORED',
      txHash: (chainResult as any).txHash || null,
    });

    return {
      registered: true,
      algorithm: `${FACE_MODEL_VERSION}/multi-sample`,
      descriptorLength: descriptors[0].length,
      descriptorCount: descriptors.length,
      registrationStep: 2,
    };
  }

  async createFaceChallenge(userId: string) {
    const user = await this.getAuthUser(userId);

    if (!user.faceEmbedding) {
      throw new UnauthorizedException('Face data is not registered');
    }

    this.assertNotFaceLocked(user);

    const challenge = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + FACE_CHALLENGE_TTL_MS);

    await this.prisma.user.update({
      where: { id: userId },
      data: { faceChallenge: challenge, faceChallengeExpiresAt: expiresAt },
    });

    return { challenge, expiresAt: expiresAt.toISOString(), ttlMs: FACE_CHALLENGE_TTL_MS };
  }

  async walletBindChallenge(userId: string, address: string) {
    const walletAddress = this.normalizeWalletAddress(address);
    const user = await this.getAdminUser(userId);

    if (!user.firstLogin) {
      throw new ForbiddenException('Wallet binding is only available during first admin setup');
    }
    if (!user.faceEmbedding) {
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
    if (!user.faceEmbedding) {
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
    if (!adminProfile.user.faceEmbedding) {
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

  async verifyFace(
    userId: string,
    embedding: number[],
    challenge: string,
    tokenWalletAddress?: string,
    ip?: string,
  ) {
    const descriptor = this.validateFaceDescriptor(embedding);
    const user = await this.getAuthUser(userId);

    if (user.role === 'ADMIN' && !tokenWalletAddress) {
      throw new UnauthorizedException('Wallet authentication is required before face verification');
    }

    if (user.status !== 'ACTIVE' || user.firstLogin) {
      throw new UnauthorizedException('Admin setup is not complete');
    }
    if (!user.faceEmbedding) {
      throw new UnauthorizedException('Face data is not registered');
    }
    if (user.role === 'ADMIN' && !user.adminProfile?.walletAddress) {
      throw new UnauthorizedException('Wallet data is not registered');
    }
    if (user.role === 'ADMIN' && user.adminProfile?.walletAddress.toLowerCase() !== tokenWalletAddress.toLowerCase()) {
      throw new UnauthorizedException('Wallet session mismatch');
    }

    this.assertNotFaceLocked(user);

    // Consume the single-use challenge atomically before matching (anti-replay).
    await this.consumeFaceChallenge(userId, challenge);

    const storedDescriptors = this.decodeStoredDescriptors(user.faceEmbedding);

    // Integrity gate: recompute the hash of the stored template and compare it to the
    // immutable on-chain value BEFORE biometric matching. If the database template was
    // swapped/altered (e.g. an attacker injected their own face), the recomputed hash will
    // not match the on-chain anchor -> block the scan. A missing anchor (legacy enrollment
    // or chain offline at enroll time) is treated as "not protected yet" and skipped.
    const onChainFaceHash = await this.blockchainService.getFaceHash(userId);
    if (onChainFaceHash) {
      const recomputedFaceHash = hashToBytes32(this.computeFaceHash(storedDescriptors)).toLowerCase();
      if (recomputedFaceHash !== onChainFaceHash.toLowerCase()) {
        await this.writeAudit(userId, 'FACE_INTEGRITY_FAIL', 'User', userId, {
          recomputedFaceHash,
          onChainFaceHash: onChainFaceHash.toLowerCase(),
          ip,
        });
        throw new UnauthorizedException('Dữ liệu khuôn mặt đã bị thay đổi. Vui lòng liên hệ quản trị viên.');
      }
    }

    const distances = storedDescriptors.map((stored) => this.euclideanDistance(descriptor, stored));
    const distance = Math.min(...distances);
    const meanDistance = distances.reduce((sum, value) => sum + value, 0) / distances.length;
    const threshold = this.getFaceMatchThreshold();
    const passed = distance <= threshold;

    console.log(
      `[FaceVerify] userId=${userId} min=${distance.toFixed(4)} mean=${meanDistance.toFixed(4)} threshold=${threshold} result=${passed ? 'PASS' : 'FAIL'}`,
    );

    if (!passed) {
      const lockInfo = await this.recordFaceFailure(user);
      await this.writeAudit(userId, 'FACE_VERIFY_FAIL', 'User', userId, {
        minDistance: Number(distance.toFixed(4)),
        meanDistance: Number(meanDistance.toFixed(4)),
        threshold,
        failedAttempts: lockInfo.failedAttempts,
        locked: lockInfo.locked,
        ip,
      });
      if (lockInfo.locked) {
        throw new UnauthorizedException('Too many failed face attempts. Account temporarily locked.');
      }
      throw new UnauthorizedException('Face verification failed');
    }

    await this.resetFaceFailures(userId);
    await this.writeAudit(userId, 'FACE_VERIFY_PASS', 'User', userId, {
      minDistance: Number(distance.toFixed(4)),
      meanDistance: Number(meanDistance.toFixed(4)),
      threshold,
      ip,
    });

    return {
      access_token: this.signAccessToken(user, {
        verified: true,
        walletAddress: user.adminProfile?.walletAddress,
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
    if (!user.faceEmbedding) {
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

  private async getAuthUser(userId: string): Promise<UserWithProfile> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { adminProfile: true },
    });

    if (!user) throw new UnauthorizedException('User not found');
    if (user.status === 'INACTIVE') throw new UnauthorizedException('Account suspended');
    return user;
  }

  private async getAdminUser(userId: string): Promise<UserWithProfile> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { adminProfile: true },
    });

    if (!user || user.role !== 'ADMIN' || !user.adminProfile) {
      throw new UnauthorizedException('Admin not found');
    }
    if (user.status === 'INACTIVE') {
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
      hasFace: Boolean(user.faceEmbedding),
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

  private hashPassword(password: string): string {
    return crypto.createHash('sha256').update(password).digest('hex');
  }

  private verifyPassword(password: string, passwordHash: string): boolean {
    if (passwordHash.startsWith('$2a$') || passwordHash.startsWith('$2b$') || passwordHash.startsWith('$2y$')) {
      return require('bcrypt').compareSync(password, passwordHash);
    }
    return this.hashPassword(password) === passwordHash;
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

  /**
   * Canonical integrity hash of a face template: SHA256 over the JSON of the validated
   * descriptor set. Used both at enrollment (anchored on-chain) and on login (recomputed
   * and compared to the on-chain anchor). Must stay in sync with how descriptors are stored.
   */
  private computeFaceHash(descriptors: number[][]): string {
    return crypto.createHash('sha256').update(JSON.stringify(descriptors)).digest('hex');
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
    // face-api euclidean distance: <0.42 = same person, 0.42-0.5 = borderline, >0.5 = different person.
    // Default 0.45 balances security vs usability. Hard-capped at 0.5 so a loose env value
    // (e.g. 0.6) cannot weaken matching below acceptable security for a clinical system.
    const DEFAULT = 0.45;
    const MAX_SAFE = 0.5;
    const threshold = Number(process.env.FACE_MATCH_THRESHOLD ?? DEFAULT);
    if (!Number.isFinite(threshold) || threshold <= 0 || threshold > 1) {
      return DEFAULT;
    }
    return Math.min(threshold, MAX_SAFE);
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

  private assertNotFaceLocked(user: { faceLockedUntil?: Date | null }) {
    if (user.faceLockedUntil && user.faceLockedUntil > new Date()) {
      const remainingMin = Math.ceil((user.faceLockedUntil.getTime() - Date.now()) / 60000);
      throw new UnauthorizedException(
        `Face verification is temporarily locked. Try again in ${remainingMin} minute(s).`,
      );
    }
  }

  private async consumeFaceChallenge(userId: string, challenge: string) {
    const now = new Date();
    const result = await this.prisma.user.updateMany({
      where: {
        id: userId,
        faceChallenge: challenge,
        faceChallengeExpiresAt: { gte: now },
      },
      data: {
        faceChallenge: null,
        faceChallengeExpiresAt: null,
      },
    });

    if (result.count !== 1) {
      throw new UnauthorizedException('Invalid or expired face challenge');
    }
  }

  private async recordFaceFailure(
    user: User,
  ): Promise<{ failedAttempts: number; locked: boolean }> {
    const failedAttempts = (user.failedFaceAttempts ?? 0) + 1;
    const locked = failedAttempts >= FACE_MAX_FAILED_ATTEMPTS;

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        // Reset the counter once locked; the lock window itself blocks further attempts.
        failedFaceAttempts: locked ? 0 : failedAttempts,
        faceLockedUntil: locked ? new Date(Date.now() + FACE_LOCKOUT_MS) : user.faceLockedUntil,
      },
    });

    return { failedAttempts, locked };
  }

  private async resetFaceFailures(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { failedFaceAttempts: 0, faceLockedUntil: null },
    });
  }

  private async writeAudit(
    actorId: string | null,
    action: string,
    entity: string,
    entityId: string | null,
    metadata?: Record<string, unknown>,
  ) {
    try {
      await this.prisma.auditLog.create({
        data: { actorId, action, entity, entityId, metadata: metadata as any },
      });
    } catch (err) {
      console.error('[AuditLog] failed to write', action, err);
    }
  }
}
