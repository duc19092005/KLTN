import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello(): string {
    return 'Hệ thống bệnh viện đang hoạt động.';
  }
}
