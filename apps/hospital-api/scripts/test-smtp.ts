import '../src/config/load-env';
import nodemailer from 'nodemailer';
import { loadMailConfig } from '../src/infrastructure/email/email.config';

function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!local || !domain) return 'địa chỉ đã cung cấp';
  return `${local.slice(0, 2)}***@${domain}`;
}

async function main(): Promise<void> {
  const recipient = process.argv[2]?.trim();
  if (!recipient || !recipient.includes('@')) {
    throw new Error('Cách dùng: npm run mail:test -- recipient@example.com');
  }

  const config = loadMailConfig();
  if (config.mode !== 'smtp') {
    throw new Error('MAIL_TRANSPORT phải là smtp để chạy smoke test email dev.');
  }

  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: { user: config.user, pass: config.pass },
    requireTLS: !config.secure,
  });

  await transporter.verify();
  await transporter.sendMail({
    from: config.from,
    to: recipient,
    subject: 'Kiểm tra SMTP - KLTN Hospital',
    text: 'Email này xác nhận cấu hình SMTP của môi trường development đang hoạt động.',
  });

  console.log(`Đã gửi email kiểm tra tới ${maskEmail(recipient)}.`);
}

main().catch((err) => {
  console.error('Kiểm tra SMTP thất bại:', err);
  console.error('Kiểm tra lại cấu hình email trong apps/hospital-api/.env.');
  process.exitCode = 1;
});
