import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './controllers/auth.controller';
import { AuthService } from './services/auth.service';
import { AuthRateLimiterService } from './services/auth-rate-limiter.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { ZkpModule } from '../zkp/zkp.module';
import { BlockchainModule } from '../../infrastructure/blockchain/blockchain.module';
import { getJwtSecret } from './constants/auth-security';

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
