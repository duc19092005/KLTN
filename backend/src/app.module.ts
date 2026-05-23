import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';
import { FaceModule } from './face/face.module';
import { ZkpModule } from './zkp/zkp.module';
import { BlockchainModule } from './blockchain/blockchain.module';
import { EmailModule } from './email/email.module';
import { PrismaModule } from './prisma/prisma.module';
import { HospitalModule } from './hospital/hospital.module';
import { EncryptionModule } from './encryption/encryption.module';
import { AiModelModule } from './ai-model/ai-model.module';
import { BackupModule } from './backup/backup.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    PrismaModule,
    AuthModule,
    UserModule,
    FaceModule,
    ZkpModule,
    BlockchainModule,
    EmailModule,
    HospitalModule,
    EncryptionModule,
    AiModelModule,
    BackupModule,
  ],
})
export class AppModule {}
