import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class AuditTelegramAlertService {
  private readonly logger = new Logger(AuditTelegramAlertService.name);

  async sendTelegramAlert(title: string, details: string, brokenSeq?: number): Promise<void> {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    const phone = process.env.ADMIN_PHONE_NUMBER ?? 'N/A';
    if (!token || !chatId || token === 'your_telegram_bot_token_here') {
      this.logger.warn('Telegram alerts are not configured or still have default placeholders. Skipping alert.');
      return;
    }
    const message = `🚨 [CẢNH BÁO BẢO MẬT] ${title.toUpperCase()}\n\n` +
      `${details}\n\n` +
      `• SĐT Admin: ${phone}\n` +
      (brokenSeq !== undefined ? `• Sequence bị lỗi: ${brokenSeq}\n` : '') +
      `• Thời gian: ${new Date().toLocaleString('vi-VN')}\n\n` +
      `⚠️ Yêu cầu Quản trị viên kiểm tra tính toàn vẹn hệ thống ngay lập tức!`;
    try {
      const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text: message }),
      });
      if (!res.ok) {
        this.logger.error(`Failed to send Telegram alert: ${res.statusText}`);
      } else {
        this.logger.log('Telegram security alert sent successfully.');
      }
    } catch (err) {
      this.logger.error('Failed to send Telegram alert via fetch', err);
    }
  }
}