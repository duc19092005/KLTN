import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { EncryptionService } from '../../../../../../../src/modules/encryption/services/encryption.service';
import { AdminFaceRecoveryArtifactAdapter } from '../../../../../../../src/modules/auth/infrastructure/adapters/admin-face-recovery-artifact.adapter';
import { AdminFaceRecoveryRestoreUseCase } from '../../../../../../../src/modules/auth/application/use-cases/admin-face-recovery-restore.use-case';
import { RegisterFaceUseCase } from '../../../../../../../src/modules/auth/application/use-cases/register-face.use-case';
import { computeFaceHash } from '../../../../../../../src/modules/auth/domain/face.util';
import { hashToBytes32 } from '../../../../../../../src/infrastructure/audit/audit-hash.util';

const USER_ID = 'admin-face-recovery-test';
const WALLET = '0x1000000000000000000000000000000000000001';

function descriptors(offset = 0): number[][] {
  return Array.from({ length: 3 }, (_, sample) =>
    Array.from({ length: 128 }, (_, index) => Number((offset + sample * 0.0001 + index * 0.00001).toFixed(6))),
  );
}

function admin(overrides: Record<string, unknown> = {}) {
  return {
    id: USER_ID,
    username: 'admin',
    email: 'admin@example.local',
    role: 'ADMIN',
    status: 'ACTIVE',
    firstLogin: false,
    registrationStep: 4,
    tokenVersion: 2,
    deletedAt: null,
    faceEmbedding: null,
    faceLockedUntil: null,
    failedFaceAttempts: 0,
    adminProfile: { walletAddress: WALLET },
    ...overrides,
  };
}

describe('Admin face recovery artifact', () => {
  const originalKey = process.env.ENCRYPTION_KEY;

  beforeEach(() => {
    process.env.ENCRYPTION_KEY = '66'.repeat(32);
  });

  afterAll(() => {
    if (originalKey === undefined) delete process.env.ENCRYPTION_KEY;
    else process.env.ENCRYPTION_KEY = originalKey;
  });

  it('round-trips an AES-256-GCM artifact bound to the on-chain checkpoint', async () => {
    let stored = Buffer.alloc(0);
    const ipfs = {
      upload: jest.fn().mockImplementation(async (bytes: Buffer) => {
        stored = Buffer.from(bytes);
        return { cid: 'bafy-test', uri: 'ipfs://bafy-test' };
      }),
      download: jest.fn().mockImplementation(async () => Buffer.from(stored)),
    };
    const adapter = new AdminFaceRecoveryArtifactAdapter(new EncryptionService(), ipfs as never);
    const enrolled = descriptors();
    const faceHash = computeFaceHash(enrolled);

    const created = await adapter.createAndUpload(USER_ID, enrolled, faceHash, 'face-api-128d-v1');
    const restored = await adapter.downloadAndVerify(USER_ID, {
      faceHash: hashToBytes32(faceHash),
      artifactHash: created.artifactHash,
      artifactUri: created.artifactUri,
      updatedAt: 1,
    });

    expect(restored).toEqual({ descriptors: enrolled, modelVersion: 'face-api-128d-v1' });
    expect(stored.toString('utf8')).not.toContain(JSON.stringify(enrolled[0]));
    expect(stored.toString('utf8')).not.toContain(USER_ID);
    expect(stored.toString('utf8')).not.toContain(hashToBytes32(faceHash));
    expect(ipfs.upload).toHaveBeenCalledWith(stored, 'admin-face-recovery.enc', 'admin-face-recovery');
  });

  it('rejects modified IPFS bytes before decryption', async () => {
    let stored = Buffer.alloc(0);
    const ipfs = {
      upload: jest.fn().mockImplementation(async (bytes: Buffer) => {
        stored = Buffer.from(bytes);
        return { cid: 'bafy-test', uri: 'ipfs://bafy-test' };
      }),
      download: jest.fn().mockImplementation(async () => Buffer.concat([stored, Buffer.from('x')])),
    };
    const adapter = new AdminFaceRecoveryArtifactAdapter(new EncryptionService(), ipfs as never);
    const enrolled = descriptors();
    const faceHash = computeFaceHash(enrolled);
    const created = await adapter.createAndUpload(USER_ID, enrolled, faceHash, 'face-api-128d-v1');

    await expect(
      adapter.downloadAndVerify(USER_ID, {
        faceHash: hashToBytes32(faceHash),
        artifactHash: created.artifactHash,
        artifactUri: created.artifactUri,
        updatedAt: 1,
      }),
    ).rejects.toThrow('artifact hash mismatch');
  });
});

describe('Admin face recovery use cases', () => {
  it('does not allow an active Admin to re-enroll after DB embedding deletion', async () => {
    const recoveryArtifact = { createAndUpload: jest.fn() };
    const useCase = new RegisterFaceUseCase(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      recoveryArtifact as never,
      { getAuthUser: jest.fn().mockResolvedValue(admin()) } as never,
    );

    await expect(useCase.execute(USER_ID, descriptors())).rejects.toThrow(ForbiddenException);
    expect(recoveryArtifact.createAndUpload).not.toHaveBeenCalled();
  });

  it('does not re-enroll when DB firstLogin is tampered but a checkpoint already exists', async () => {
    const recoveryArtifact = { createAndUpload: jest.fn() };
    const chain = { getFaceRecovery: jest.fn().mockResolvedValue({ artifactUri: 'ipfs://trusted' }) };
    const useCase = new RegisterFaceUseCase(
      {} as never,
      {} as never,
      chain as never,
      {} as never,
      recoveryArtifact as never,
      { getAuthUser: jest.fn().mockResolvedValue(admin({ firstLogin: true })) } as never,
    );

    await expect(useCase.execute(USER_ID, descriptors())).rejects.toThrow(ForbiddenException);
    expect(recoveryArtifact.createAndUpload).not.toHaveBeenCalled();
  });

  it('restores the trusted descriptors and issues a new verified session', async () => {
    const enrolled = descriptors();
    const restoredAdmin = admin({
      faceEmbedding: 'restored-ciphertext',
      faceHash: computeFaceHash(enrolled),
      tokenVersion: 3,
    });
    const repo = {
      consumeFaceChallenge: jest.fn().mockResolvedValue(1),
      restoreFaceEnrollmentAndInvalidateSessions: jest.fn().mockResolvedValue(restoredAdmin),
    };
    const chain = {
      isAuthorized: jest.fn().mockResolvedValue(true),
      getFaceRecovery: jest.fn().mockResolvedValue({
        faceHash: hashToBytes32(computeFaceHash(enrolled)),
        artifactHash: `0x${'a'.repeat(64)}`,
        artifactUri: 'ipfs://bafy-test',
        updatedAt: 123,
      }),
    };
    const artifact = {
      downloadAndVerify: jest.fn().mockResolvedValue({ descriptors: enrolled, modelVersion: 'face-api-128d-v1' }),
    };
    const cipher = { encryptSecret: jest.fn().mockReturnValue('restored-ciphertext') };
    const audit = { write: jest.fn().mockResolvedValue(undefined) };
    const tokenSigner = { sign: jest.fn().mockReturnValue('verified-token') };
    const useCase = new AdminFaceRecoveryRestoreUseCase(
      repo as never,
      tokenSigner as never,
      chain as never,
      artifact as never,
      cipher as never,
      audit as never,
      { getAuthUser: jest.fn().mockResolvedValue(admin()) } as never,
      { computeMatch: jest.fn().mockReturnValue({ passed: true }) } as never,
    );

    const result = await useCase.execute(USER_ID, enrolled[0], 'c'.repeat(64), WALLET, '127.0.0.1');

    expect(repo.restoreFaceEnrollmentAndInvalidateSessions).toHaveBeenCalledWith(
      USER_ID,
      expect.objectContaining({
        faceHash: computeFaceHash(enrolled),
        faceSampleCount: enrolled.length,
        faceEmbedding: 'restored-ciphertext',
      }),
    );
    expect(tokenSigner.sign).toHaveBeenCalledWith(restoredAdmin, {
      verified: true,
      walletAddress: WALLET,
    });
    expect(audit.write).toHaveBeenCalledWith(
      USER_ID,
      'ADMIN_FACE_RESTORED_FROM_IPFS',
      'User',
      USER_ID,
      expect.objectContaining({ checkpointUpdatedAt: 123 }),
    );
    expect(result).toEqual(expect.objectContaining({ restored: true, verified: true }));
  });

  it('rejects a live face that does not match the trusted artifact', async () => {
    const enrolled = descriptors();
    const faceMatch = {
      computeMatch: jest.fn().mockReturnValue({ passed: false }),
      recordFailure: jest.fn().mockResolvedValue({ failedAttempts: 1, locked: false }),
    };
    const useCase = new AdminFaceRecoveryRestoreUseCase(
      { consumeFaceChallenge: jest.fn().mockResolvedValue(1) } as never,
      {} as never,
      {
        isAuthorized: jest.fn().mockResolvedValue(true),
        getFaceRecovery: jest.fn().mockResolvedValue({
          faceHash: hashToBytes32(computeFaceHash(enrolled)),
          artifactHash: `0x${'a'.repeat(64)}`,
          artifactUri: 'ipfs://bafy-test',
          updatedAt: 123,
        }),
      } as never,
      {
        downloadAndVerify: jest.fn().mockResolvedValue({
          descriptors: enrolled,
          modelVersion: 'face-api-128d-v1',
        }),
      } as never,
      {} as never,
      { write: jest.fn().mockResolvedValue(undefined) } as never,
      { getAuthUser: jest.fn().mockResolvedValue(admin()) } as never,
      faceMatch as never,
    );

    await expect(useCase.execute(USER_ID, descriptors(0.5)[0], 'c'.repeat(64), WALLET)).rejects.toThrow(
      UnauthorizedException,
    );
    expect(faceMatch.recordFailure).toHaveBeenCalled();
  });
});
