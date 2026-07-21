import { ServiceUnavailableException } from '@nestjs/common';
import { MailConfig } from '../../../src/infrastructure/email/email.types';
import { TemporaryCredentialMailService } from '../../../src/infrastructure/email/temporary-credential-mail.service';

describe('TemporaryCredentialMailService', () => {
  const config: MailConfig = {
    mode: 'json',
    host: 'localhost',
    port: 1025,
    secure: false,
    user: 'test',
    pass: 'test',
    from: 'KLTN Hospital Test <no-reply@test.local>',
  };

  it('gửi đúng thông tin đăng nhập tạm cho email nhân sự', async () => {
    const sendMail = jest.fn().mockResolvedValue({ accepted: ['doctor@test.local'], rejected: [] });
    const service = new TemporaryCredentialMailService({ sendMail } as never, config);

    await service.sendTemporaryPassword({
      to: 'doctor@test.local',
      fullName: 'Nguyễn Văn A',
      username: 'doctora',
      temporaryPassword: 'Temp!Password234',
    });

    expect(sendMail).toHaveBeenCalledTimes(1);
    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        from: config.from,
        to: 'doctor@test.local',
        subject: expect.stringContaining('Thông tin đăng nhập tạm thời'),
        text: expect.stringContaining('Tên đăng nhập: doctora'),
      }),
    );
    expect(sendMail.mock.calls[0][0].text).toContain('Mật khẩu tạm thời: Temp!Password234');
  });

  it('không che giấu lỗi gửi email và trả thông báo nghiệp vụ an toàn', async () => {
    const sendMail = jest.fn().mockRejectedValue(new Error('SMTP password leaked in transport error'));
    const service = new TemporaryCredentialMailService({ sendMail } as never, config);

    await expect(
      service.sendTemporaryPassword({
        to: 'staff@test.local',
        fullName: 'Nhân sự Test',
        username: 'stafftest',
        temporaryPassword: 'Temp!Password234',
      }),
    ).rejects.toEqual(
      new ServiceUnavailableException(
        'Không thể gửi email mật khẩu tạm. Tài khoản chưa được tạo, vui lòng thử lại.',
      ),
    );
  });
});
