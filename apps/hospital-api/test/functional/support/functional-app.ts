import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import cookieParser from 'cookie-parser';
import { AppModule } from '../../../src/app.module';
import { getJwtSecret } from '../../../src/modules/auth/constants/auth-security';
import { PrismaService } from '../../../src/infrastructure/prisma/prisma.service';

type FunctionalTokenUser = {
  id: string;
  role: string;
  tokenVersion: number;
  verified?: boolean;
};

export type FunctionalApp = {
  app: INestApplication;
  prisma: PrismaService;
  tokenFor: (user: FunctionalTokenUser) => string;
  close: () => Promise<void>;
};

export async function createFunctionalApp(): Promise<FunctionalApp> {
  const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = module.createNestApplication();
  app.use(cookieParser());
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  app.setGlobalPrefix('api');
  await app.init();

  const prisma = app.get(PrismaService);
  const jwt = app.get(JwtService);

  return {
    app,
    prisma,
    tokenFor: (user) =>
      jwt.sign(
        {
          sub: user.id,
          role: user.role,
          tokenVersion: user.tokenVersion,
          verified: user.verified ?? true,
        },
        { secret: getJwtSecret() },
      ),
    close: () => app.close(),
  };
}

export function unwrap<T>(body: unknown): T {
  const candidate = body as { data?: T };
  return candidate.data ?? (body as T);
}
