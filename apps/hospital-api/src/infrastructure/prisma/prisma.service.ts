import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    if (process.env.SKIP_PRISMA_CONNECT === 'true') return;
    await this.$connect();
    console.log('✅ Database connected');
  }

  async onModuleDestroy() {
    if (process.env.SKIP_PRISMA_CONNECT === 'true') return;
    await this.$disconnect();
  }
}
