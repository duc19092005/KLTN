import { Inject, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { Transporter } from 'nodemailer';
import { MAIL_CONFIG, MAIL_TRANSPORTER } from './email.constants';
import {
  MailConfig,
  TemporaryCredentialMailerPort,
  TemporaryCredentialMessage,
} from './email.types';

@Injectable()
export class TemporaryCredentialMailService implements TemporaryCredentialMailerPort {
  constructor(
    @Inject(MAIL_TRANSPORTER) private readonly transporter: Transporter,
    @Inject(MAIL_CONFIG) private readonly config: MailConfig,
  ) {}

  async sendTemporaryPassword(message: TemporaryCredentialMessage): Promise<void> {
    try {
      const result = await this.transporter.sendMail({
        from: this.config.from,
        to: message.to,
        subject: 'Thông tin đăng nhập tạm thời - KLTN Hospital',
        text: [
          `Xin chào ${message.fullName},`,
          '',
          'Tài khoản nhân sự của bạn đã được tạo.',
          `Tên đăng nhập: ${message.username}`,
          `Mật khẩu tạm thời: ${message.temporaryPassword}`,
          '',
          'Vui lòng đăng nhập và đổi mật khẩu ngay trong lần sử dụng đầu tiên.',
          'Không chia sẻ email hoặc mật khẩu này cho người khác.',
        ].join('\n'),
      });

      if (this.config.mode === 'smtp' && Array.isArray(result.rejected) && result.rejected.length > 0) {
        throw new Error('SMTP rejected recipient');
      }
    } catch {
      throw new ServiceUnavailableException(
        'Không thể gửi email mật khẩu tạm. Tài khoản chưa được tạo, vui lòng thử lại.',
      );
    }
  }
}
