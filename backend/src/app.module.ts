import 'dotenv/config';
import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { BlockchainModule } from './blockchain/blockchain.module';
import { PrismaModule } from './prisma/prisma.module';
import { ZkpModule } from './zkp/zkp.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [
    PrismaModule,
    BlockchainModule,
    ZkpModule,
    AuthModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
