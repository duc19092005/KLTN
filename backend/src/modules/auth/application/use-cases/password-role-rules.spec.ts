import { BadRequestException } from '@nestjs/common';
import { ChangePasswordUseCase } from './change-password.use-case';
import { ForgotPasswordChallengeUseCase } from './forgot-password-challenge.use-case';

describe('Password role rules', () => {
  it('rejects password changes for Admin accounts', async () => {
    const repo = {
      findUserWithProfile: jest.fn().mockResolvedValue({ id: 'admin-1', role: 'ADMIN', passwordHash: 'unused' }),
    };
    const useCase = new ChangePasswordUseCase(repo as never, {} as never, { write: jest.fn() } as never);

    await expect(useCase.execute('admin-1', 'old-password', 'new-password')).rejects.toThrow(BadRequestException);
  });

  it('rejects forgot-password challenges for Admin accounts', async () => {
    const repo = {
      findUserByIdentity: jest.fn().mockResolvedValue({ id: 'admin-1', role: 'ADMIN', faceEmbedding: 'face' }),
    };
    const useCase = new ForgotPasswordChallengeUseCase(repo as never);

    await expect(useCase.execute('admin')).rejects.toThrow('Chức năng quên mật khẩu chỉ áp dụng cho tài khoản nhân sự.');
  });
});
