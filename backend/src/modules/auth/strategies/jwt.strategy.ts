import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Request } from 'express';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { getJwtSecret } from '../constants/auth-security';

const cookieExtractor = (req: Request): string | null => {
  const token = req?.cookies?.token;
  return token || ExtractJwt.fromAuthHeaderAsBearerToken()(req);
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly prisma: PrismaService) {
    super({
      jwtFromRequest: cookieExtractor,
      ignoreExpiration: false,
      secretOrKey: getJwtSecret(),
    });
  }

  async validate(payload: any) {
    if (!payload?.sub || typeof payload.tokenVersion !== 'number') {
      throw new UnauthorizedException('Invalid token payload');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: { adminProfile: true },
    });

    if (!user || user.status === 'INACTIVE' || user.tokenVersion !== payload.tokenVersion) {
      throw new UnauthorizedException('Invalid session');
    }

    return {
      sub: user.id,
      username: user.username,
      role: user.role,
      verified: Boolean(payload.verified),
      walletAddress: payload.walletAddress || user.adminProfile?.walletAddress,
      firstLogin: user.firstLogin,
      tokenVersion: user.tokenVersion,
    };
  }
}
