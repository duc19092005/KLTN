import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Request } from 'express';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { getJwtSecret } from '../constants/auth-security';

const cookieExtractor = (req: Request): string | null => {
  const token = req?.cookies?.token || req?.query?.token;
  return (token as string) || ExtractJwt.fromAuthHeaderAsBearerToken()(req);
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
      throw new UnauthorizedException('Phiên đăng nhập không hợp lệ.');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: { adminProfile: true, patientAccesses: { where: { status: 'ACTIVE' } } },
    });

    if (!user || user.status === 'INACTIVE' || user.tokenVersion !== payload.tokenVersion) {
      throw new UnauthorizedException('Phiên đăng nhập không hợp lệ hoặc đã hết hạn.');
    }

    return {
      sub: user.id,
      username: user.username,
      role: user.role,
      verified: Boolean(payload.verified),
      walletAddress: payload.walletAddress || user.adminProfile?.walletAddress,
      firstLogin: user.firstLogin,
      tokenVersion: user.tokenVersion,
      staffId: payload.staffId,
      staffName: payload.staffName,
      shiftId: payload.shiftId,
      patientId: payload.patientId || payload.patientIds?.[0] || user.patientAccesses[0]?.patientId,
      patientIds: payload.patientIds || user.patientAccesses.map((access) => access.patientId),
    };
  }
}
