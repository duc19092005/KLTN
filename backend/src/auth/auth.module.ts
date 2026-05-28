import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthRateLimiterService } from './auth-rate-limiter.service';
import { JwtStrategy } from './jwt.strategy';
import { ZkpModule } from '../zkp/zkp.module';
import { BlockchainModule } from '../blockchain/blockchain.module';
import { getJwtSecret } from './auth-security';

@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      useFactory: () => ({
        secret: getJwtSecret(),
        signOptions: { expiresIn: (process.env.JWT_EXPIRATION || '1h') as any },
      }),
    }),
    ZkpModule,
    BlockchainModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, AuthRateLimiterService, JwtStrategy],
  exports: [AuthService, JwtModule],
})
export class AuthModule {}
