import { VerifyFaceUseCase } from '../../../../../../../src/modules/auth/application/use-cases/verify-face.use-case';

const descriptor = Array(128).fill(0.1);
const storedDescriptors = [descriptor, descriptor, descriptor];

function adminUser(overrides: Record<string, unknown> = {}) {
  return {
    id: '11111111-1111-4111-8111-111111111111', username: 'admin-face', email: 'admin-face@test.local',
    role: 'ADMIN', status: 'ACTIVE', firstLogin: false, tokenVersion: 0,
    faceEmbedding: JSON.stringify(storedDescriptors), faceLockedUntil: null, failedFaceAttempts: 0,
    adminProfile: { walletAddress: '0x1111111111111111111111111111111111111111' }, ...overrides,
  };
}

function makeHarness() {
  const user = adminUser();
  const repo = { consumeFaceChallenge: jest.fn().mockResolvedValue(1), updateFaceFailure: jest.fn(), resetFaceFailures: jest.fn() };
  const signer = { sign: jest.fn().mockReturnValue('verified-access-token') };
  const audit = { write: jest.fn().mockResolvedValue(undefined) };
  const lookup = { getAuthUser: jest.fn().mockResolvedValue(user) };
  const faceMatch = {
    decodeStoredDescriptors: jest.fn().mockReturnValue(storedDescriptors),
    checkIntegrity: jest.fn().mockResolvedValue({ ok: true, recomputedFaceHash: '0xhash', onChainFaceHash: '0xhash' }),
    computeMatch: jest.fn().mockReturnValue({ distance: 0, meanDistance: 0, threshold: 0.45, passed: true }),
    recordFailure: jest.fn(), resetFailures: jest.fn().mockResolvedValue(undefined),
  };
  const useCase = new VerifyFaceUseCase(repo as never, signer as never, audit as never, lookup as never, faceMatch as never);
  return { useCase, user, repo, signer, audit, lookup, faceMatch };
}

describe('VerifyFaceUseCase functional security scenarios', () => {
  it('[TC1.03] marks Admin A verified after a valid single-use challenge and matching face descriptor', async () => {
    const { useCase, user, repo, signer, audit, faceMatch } = makeHarness();
    await expect(useCase.execute(user.id, descriptor, 'valid-challenge', user.adminProfile.walletAddress, '127.0.0.1'))
      .resolves.toMatchObject({ verified: true, access_token: 'verified-access-token', matchedDescriptorCount: 3 });
    expect(repo.consumeFaceChallenge).toHaveBeenCalledWith(user.id, 'valid-challenge', expect.any(Date));
    expect(faceMatch.resetFailures).toHaveBeenCalledWith(user.id);
    expect(signer.sign).toHaveBeenCalledWith(user, expect.objectContaining({ verified: true }));
    expect(audit.write).toHaveBeenCalledWith(user.id, 'FACE_VERIFY_PASS', 'User', user.id, expect.any(Object));
  });

  it('[TC1.04] rejects a wrong or expired challenge before matching and does not issue a verified token', async () => {
    const { useCase, user, repo, signer, faceMatch } = makeHarness();
    repo.consumeFaceChallenge.mockResolvedValueOnce(0);
    await expect(useCase.execute(user.id, descriptor, 'expired-challenge', user.adminProfile.walletAddress))
      .rejects.toThrow('Yêu cầu xác thực khuôn mặt không hợp lệ hoặc đã hết hạn.');
    expect(faceMatch.computeMatch).not.toHaveBeenCalled();
    expect(signer.sign).not.toHaveBeenCalled();
  });

  it('[TC1.05] locks after repeated mismatches and blocks the next attempt during the lock window', async () => {
    const { useCase, user, repo, signer, lookup, faceMatch } = makeHarness();
    faceMatch.computeMatch.mockReturnValue({ distance: 1.1, meanDistance: 1.1, threshold: 0.45, passed: false });
    faceMatch.recordFailure
      .mockResolvedValueOnce({ failedAttempts: 1, locked: false }).mockResolvedValueOnce({ failedAttempts: 2, locked: false })
      .mockResolvedValueOnce({ failedAttempts: 3, locked: false }).mockResolvedValueOnce({ failedAttempts: 4, locked: false })
      .mockResolvedValueOnce({ failedAttempts: 5, locked: true });
    for (let attempt = 1; attempt <= 4; attempt += 1) {
      await expect(useCase.execute(user.id, descriptor, `challenge-${attempt}`, user.adminProfile.walletAddress))
        .rejects.toThrow('Xác thực khuôn mặt thất bại.');
    }
    await expect(useCase.execute(user.id, descriptor, 'challenge-5', user.adminProfile.walletAddress))
      .rejects.toThrow('Thử sai quá nhiều lần. Tài khoản tạm thời bị khóa.');
    lookup.getAuthUser.mockResolvedValueOnce(adminUser({ faceLockedUntil: new Date(Date.now() + 10 * 60_000) }));
    repo.consumeFaceChallenge.mockClear();
    await expect(useCase.execute(user.id, descriptor, 'challenge-6', user.adminProfile.walletAddress))
      .rejects.toThrow('Xác thực khuôn mặt đang bị khóa tạm thời.');
    expect(repo.consumeFaceChallenge).not.toHaveBeenCalled();
    expect(faceMatch.recordFailure).toHaveBeenCalledTimes(5);
    expect(signer.sign).not.toHaveBeenCalled();
  });
});
