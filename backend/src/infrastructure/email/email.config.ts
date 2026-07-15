import { MailConfig, MailTransportMode } from './email.types';

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Thiếu cấu hình email ${name}.`);
  return value;
}

export function loadMailConfig(): MailConfig {
  const mode = (process.env.MAIL_TRANSPORT?.trim().toLowerCase() || 'smtp') as MailTransportMode;
  if (!['smtp', 'json'].includes(mode)) {
    throw new Error('MAIL_TRANSPORT chỉ hỗ trợ smtp hoặc json.');
  }

  if (mode === 'json') {
    return {
      mode,
      host: process.env.SMTP_HOST?.trim() || 'localhost',
      port: Number(process.env.SMTP_PORT || 1025),
      secure: false,
      user: process.env.SMTP_USER?.trim() || '',
      pass: process.env.SMTP_PASS || '',
      from: process.env.SMTP_FROM?.trim() || 'KLTN Hospital Test <no-reply@test.local>',
    };
  }

  const port = Number(required('SMTP_PORT'));
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('SMTP_PORT không hợp lệ.');
  }

  return {
    mode,
    host: required('SMTP_HOST'),
    port,
    secure: process.env.SMTP_SECURE === 'true' || port === 465,
    user: required('SMTP_USER'),
    pass: required('SMTP_PASS'),
    from: required('SMTP_FROM'),
  };
}
