import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class EsmsService {
  private readonly logger = new Logger(EsmsService.name);

  async sendOtp(phone: string, otp: string): Promise<void> {
    const apiKey = process.env.ESMS_API_KEY;
    const secretKey = process.env.ESMS_SECRET_KEY;

    if (!apiKey || !secretKey) {
      this.logger.warn(`ESMS chưa cấu hình; OTP dev cho ${this.maskPhone(phone)} là ${otp}`);
      return;
    }

    const smsType = process.env.ESMS_SMS_TYPE || '2';
    const body: Record<string, string> = {
      ApiKey: apiKey,
      SecretKey: secretKey,
      Phone: phone,
      Content: `Ma OTP dang nhap KLTN cua quy khach la ${otp}. Ma co hieu luc trong 5 phut.`,
      SmsType: smsType,
      IsUnicode: '0',
    };

    // Brandname is required for SmsType 2 (branded CSKH) and 1 (branded ads).
    const brandname = process.env.ESMS_BRANDNAME;
    if (brandname) {
      body.Brandname = brandname;
    }

    this.logger.log(`Gửi OTP tới ${this.maskPhone(phone)} (SmsType=${smsType})`);

    try {
      const response = await fetch(
        'https://rest.esms.vn/MainService.svc/json/SendMultipleMessage_V4_post_json/',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        },
      );

      const result = await response.json() as {
        CodeResult?: string;
        ErrorMessage?: string;
        SMSID?: string;
      };

      this.logger.log(`ESMS response: CodeResult=${result.CodeResult}, ErrorMessage=${result.ErrorMessage ?? 'none'}, SMSID=${result.SMSID ?? 'none'}`);

      // eSMS returns HTTP 200 for everything; CodeResult '100' means success.
      if (result.CodeResult !== '100') {
        this.logger.error(
          `ESMS gửi OTP thất bại: CodeResult=${result.CodeResult}, Error=${result.ErrorMessage}`,
        );
        if (process.env.NODE_ENV !== 'production') {
          this.logger.warn(`[DEV MODE] Bỏ qua lỗi eSMS. OTP của ${this.maskPhone(phone)} là: ${otp}`);
          return;
        }
        throw new Error(`Không gửi được OTP (ESMS code ${result.CodeResult}). Vui lòng thử lại sau.`);
      }
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('Không gửi được OTP')) {
        throw error;
      }
      this.logger.error(`ESMS request lỗi: ${error}`);
      if (process.env.NODE_ENV !== 'production') {
        this.logger.warn(`[DEV MODE] Bỏ qua lỗi network. OTP của ${this.maskPhone(phone)} là: ${otp}`);
        return;
      }
      throw new Error('Không gửi được OTP. Vui lòng thử lại sau.');
    }
  }

  private maskPhone(phone: string): string {
    return phone.replace(/\d(?=\d{3})/g, '*');
  }
}
