import { Inject, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { Transporter } from 'nodemailer';
import { MAIL_CONFIG, MAIL_TRANSPORTER } from './email.constants';
import {
  MailConfig,
  TemporaryCredentialMailerPort,
  TemporaryCredentialMessage,
} from './email.types';

@Injectable()
export class TemporaryCredentialMailService implements TemporaryCredentialMailerPort {
  private readonly logger = new Logger(TemporaryCredentialMailService.name);

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
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <style>
              body {
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                background-color: #f4f6f8;
                margin: 0;
                padding: 0;
              }
              .container {
                max-width: 600px;
                margin: 20px auto;
                background: #ffffff;
                border-radius: 12px;
                border: 1px solid #e1e5eb;
                box-shadow: 0 4px 12px rgba(0,0,0,0.03);
                overflow: hidden;
              }
              .header {
                background: linear-gradient(135deg, #0891b2 0%, #0e7490 100%);
                color: #ffffff;
                padding: 30px 20px;
                text-align: center;
              }
              .header h1 {
                margin: 0;
                font-size: 24px;
                font-weight: 700;
                letter-spacing: -0.5px;
              }
              .header p {
                margin: 5px 0 0 0;
                font-size: 14px;
                opacity: 0.9;
              }
              .content {
                padding: 30px;
                color: #334155;
                line-height: 1.6;
              }
              .content p {
                margin: 0 0 15px 0;
                font-size: 15px;
              }
              .credential-card {
                background-color: #f8fafc;
                border: 1px solid #cbd5e1;
                border-radius: 8px;
                padding: 20px;
                margin: 25px 0;
              }
              .credential-row {
                margin-bottom: 10px;
                font-size: 15px;
              }
              .credential-row:last-child {
                margin-bottom: 0;
              }
              .label {
                display: inline-block;
                width: 140px;
                color: #64748b;
                font-weight: 600;
              }
              .value {
                color: #0f172a;
                font-family: "Courier New", Courier, monospace;
                font-weight: 700;
              }
              .btn-container {
                text-align: center;
                margin: 30px 0 15px 0;
              }
              .btn {
                display: inline-block;
                background-color: #0891b2;
                color: #ffffff !important;
                text-decoration: none;
                padding: 12px 24px;
                border-radius: 8px;
                font-weight: 700;
                font-size: 14px;
              }
              .footer {
                background-color: #f8fafc;
                padding: 20px;
                text-align: center;
                font-size: 12px;
                color: #64748b;
                border-top: 1px solid #e2e8f0;
              }
              .warning {
                color: #b91c1c;
                font-weight: 600;
              }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>KLTN Hospital OS</h1>
                <p>Hệ thống Quản lý Y tế Toàn diện</p>
              </div>
              <div class="content">
                <p>Xin chào <strong>${message.fullName}</strong>,</p>
                <p>Tài khoản nhân sự của bạn đã được tạo thành công trên hệ thống Hospital OS. Dưới đây là thông tin đăng nhập tạm thời của bạn:</p>
                
                <div class="credential-card">
                  <div class="credential-row">
                    <span class="label">Tên đăng nhập:</span>
                    <span class="value">${message.username}</span>
                  </div>
                  <div class="credential-row">
                    <span class="label">Mật khẩu tạm:</span>
                    <span class="value">${message.temporaryPassword}</span>
                  </div>
                </div>
                
                <p class="warning">⚠️ Quan trọng: Vui lòng đăng nhập và thực hiện đổi mật khẩu ngay trong lần sử dụng đầu tiên để kích hoạt tài khoản.</p>
                <p>Không chia sẻ thông tin đăng nhập hoặc email này cho bất kỳ ai để đảm bảo an toàn thông tin y tế.</p>
                
                <div class="btn-container">
                  <a href="http://localhost:5173" class="btn" target="_blank">Đăng Nhập Hệ Thống</a>
                </div>
              </div>
              <div class="footer">
                <p>© 2026 KLTN Hospital OS. Hệ thống quản trị an toàn thông tin sinh trắc học và blockchain.</p>
                <p>Đây là email tự động, vui lòng không phản hồi email này.</p>
              </div>
            </div>
          </body>
          </html>
        `,
      });

      if (this.config.mode === 'smtp' && Array.isArray(result.rejected) && result.rejected.length > 0) {
        throw new Error('SMTP rejected recipient');
      }
    } catch (error) {
      this.logger.error('Gửi email mật khẩu tạm thất bại:', error);
      throw new ServiceUnavailableException(
        'Không thể gửi email mật khẩu tạm. Tài khoản chưa được tạo, vui lòng thử lại.',
      );
    }
  }
}
