import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { ChangePasswordUseCase } from '../../../../../../../src/modules/auth/application/use-cases/change-password.use-case';
import { ForgotPasswordChallengeUseCase } from '../../../../../../../src/modules/auth/application/use-cases/forgot-password-challenge.use-case';
import * as credential from '../../../../../../../src/modules/auth/domain/credential.util';

describe('Password role rules', () => {
  it('rejects password changes for Admin accounts and audits denial', async () => {
    const repo = {
      findUserWithProfile: jest.fn().mockResolvedValue({ id: 'admin-1', role: 'ADMIN', passwordHash: 'unused' }),
    };
    const audit = { write: jest.fn().mockResolvedValue(undefined) };
    const useCase = new ChangePasswordUseCase(repo as never, {} as never, audit as never);

    await expect(useCase.execute('admin-1', 'old-password', 'new-password')).rejects.toThrow(BadRequestException);
    expect(audit.write).toHaveBeenCalledWith(
      'admin-1',
      'PASSWORD_CHANGE_DENIED',
      'User',
      'admin-1',
      expect.objectContaining({ reason: 'ROLE_NOT_ALLOWED' }),
    );
  });

  it('rejects password changes for Patient accounts', async () => {
    const repo = {
      findUserWithProfile: jest.fn().mockResolvedValue({ id: 'patient-1', role: 'PATIENT', passwordHash: 'unused' }),
    };
    const audit = { write: jest.fn().mockResolvedValue(undefined) };
    const useCase = new ChangePasswordUseCase(repo as never, {} as never, audit as never);

    await expect(useCase.execute('patient-1', 'old-password', 'new-password')).rejects.toThrow(BadRequestException);
  });

  it('rejects wrong current password and audits failure', async () => {
    jest.spyOn(credential, 'verifyPassword').mockReturnValue(false);
    const repo = {
      findUserWithProfile: jest.fn().mockResolvedValue({
        id: 'staff-1',
        role: 'RECEPTIONIST',
        passwordHash: 'hashed',
      }),
    };
    const audit = { write: jest.fn().mockResolvedValue(undefined) };
    const useCase = new ChangePasswordUseCase(repo as never, {} as never, audit as never);

    await expect(useCase.execute('staff-1', 'wrong', 'new-password')).rejects.toThrow(UnauthorizedException);
    expect(audit.write).toHaveBeenCalledWith(
      'staff-1',
      'PASSWORD_CHANGE_FAILED',
      'User',
      'staff-1',
      expect.objectContaining({ reason: 'INVALID_CURRENT_PASSWORD' }),
    );
  });

  it('rejects forgot-password challenges for Admin accounts and audits denial', async () => {
    const repo = {
      findUserByIdentity: jest.fn().mockResolvedValue({ id: 'admin-1', role: 'ADMIN', faceEmbedding: 'face' }),
    };
    const audit = { write: jest.fn().mockResolvedValue(undefined) };
    const useCase = new ForgotPasswordChallengeUseCase(repo as never, audit as never);

    await expect(useCase.execute('admin')).rejects.toThrow('Chức năng quên mật khẩu chỉ áp dụng cho tài khoản nhân sự.');
    expect(audit.write).toHaveBeenCalledWith(
      'admin-1',
      'FORGOT_PASSWORD_DENIED',
      'User',
      'admin-1',
      expect.objectContaining({ reason: 'ROLE_NOT_ALLOWED' }),
    );
  });

  it('rejects forgot-password challenges for Patient accounts', async () => {
    const repo = {
      findUserByIdentity: jest.fn().mockResolvedValue({ id: 'patient-1', role: 'PATIENT', faceEmbedding: 'face' }),
    };
    const audit = { write: jest.fn().mockResolvedValue(undefined) };
    const useCase = new ForgotPasswordChallengeUseCase(repo as never, audit as never);

    await expect(useCase.execute('patient')).rejects.toThrow('Chức năng quên mật khẩu chỉ áp dụng cho tài khoản nhân sự.');
  });
});
