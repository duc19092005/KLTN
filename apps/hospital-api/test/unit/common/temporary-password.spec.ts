import { generateTemporaryPassword } from '../../../src/common/security/temporary-password';

describe('generateTemporaryPassword', () => {
  it('tạo mật khẩu tạm đủ độ dài và đủ bốn nhóm ký tự', () => {
    const password = generateTemporaryPassword();

    expect(password).toHaveLength(16);
    expect(password).toMatch(/[A-Z]/);
    expect(password).toMatch(/[a-z]/);
    expect(password).toMatch(/[0-9]/);
    expect(password).toMatch(/[!@#$%^&*]/);
    expect(password).not.toBe('123456');
  });

  it('không tạo cùng một mật khẩu cho nhiều tài khoản liên tiếp', () => {
    const passwords = new Set(Array.from({ length: 20 }, () => generateTemporaryPassword()));
    expect(passwords.size).toBe(20);
  });

  it('từ chối độ dài thấp hơn chuẩn bảo mật', () => {
    expect(() => generateTemporaryPassword(11)).toThrow('ít nhất 12 ký tự');
  });
});
