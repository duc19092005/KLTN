const crypto = require('crypto');
const fs = require('fs');
const http = require('http');
const path = require('path');
const dotenv = require('dotenv');
const { PrismaClient, UserRole, UserStatus } = require('@prisma/client');
const { JwtService } = require('@nestjs/jwt');

const backendDir = path.resolve(__dirname, '..');
dotenv.config({ path: path.join(backendDir, '.env') });

const IS_DOCKER = fs.existsSync('/.dockerenv');
const SESSION_HOST = process.env.LOCAL_ADMIN_SESSION_HOST || (IS_DOCKER ? '0.0.0.0' : '127.0.0.1');
const SESSION_PORT = Number(process.env.LOCAL_ADMIN_SESSION_PORT || 43173);
const SESSION_TTL_MS = 2 * 60 * 1000;
const ADMIN_REDIRECT_URL = process.env.LOCAL_ADMIN_REDIRECT_URL || 'http://localhost:5173/admin';
const COOKIE_MAX_AGE_MS = Number(process.env.JWT_COOKIE_MAX_AGE_MS || 60 * 60 * 1000);
const JWT_EXPIRATION = process.env.JWT_EXPIRATION || '1h';
const MIN_JWT_SECRET_LENGTH = 32;

function assertLocalDevelopmentConfig() {
  if (process.env.NODE_ENV !== 'development') {
    throw new Error('Local admin session is available only when NODE_ENV=development.');
  }

  const databaseUrl = new URL(process.env.DATABASE_URL || '');
  const allowedDatabaseHosts = IS_DOCKER ? ['db'] : ['localhost', '127.0.0.1'];
  if (!allowedDatabaseHosts.includes(databaseUrl.hostname)) {
    throw new Error('Local admin session requires the local Docker or localhost PostgreSQL database.');
  }

  const allowedSessionHosts = IS_DOCKER ? ['0.0.0.0'] : ['127.0.0.1'];
  if (!allowedSessionHosts.includes(SESSION_HOST)) {
    throw new Error('LOCAL_ADMIN_SESSION_HOST is not safe for the current local runtime.');
  }

  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < MIN_JWT_SECRET_LENGTH) {
    throw new Error(`JWT_SECRET must contain at least ${MIN_JWT_SECRET_LENGTH} characters.`);
  }

  const redirectUrl = new URL(ADMIN_REDIRECT_URL);
  if (redirectUrl.hostname !== 'localhost' || redirectUrl.protocol !== 'http:') {
    throw new Error('LOCAL_ADMIN_REDIRECT_URL must use http://localhost for local development.');
  }

  if (!Number.isInteger(SESSION_PORT) || SESSION_PORT < 1024 || SESSION_PORT > 65535) {
    throw new Error('LOCAL_ADMIN_SESSION_PORT must be an unprivileged TCP port.');
  }
}

async function ensureLocalAdmin(prisma) {
  const existingAdmin = await prisma.user.findFirst({
    where: { role: UserRole.ADMIN },
    orderBy: { createdAt: 'asc' },
  });

  if (existingAdmin) {
    return prisma.user.update({
      where: { id: existingAdmin.id },
      data: {
        status: UserStatus.ACTIVE,
        firstLogin: false,
      },
    });
  }

  const suffix = crypto.randomBytes(4).toString('hex');
  return prisma.user.create({
    data: {
      username: `local-admin-${suffix}`,
      email: `local-admin-${suffix}@hospital.local`,
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
      firstLogin: false,
      adminProfile: {
        create: { adminUserName: `local-admin-${suffix}` },
      },
    },
  });
}

function signAdminToken(admin) {
  const jwt = new JwtService({
    secret: process.env.JWT_SECRET,
    signOptions: { expiresIn: JWT_EXPIRATION },
  });

  return jwt.sign({
    sub: admin.id,
    username: admin.username,
    role: admin.role,
    verified: true,
    isFirstLogin: false,
    tokenVersion: admin.tokenVersion,
  });
}

function sessionCookie(token) {
  const maxAgeSeconds = Math.max(1, Math.floor(COOKIE_MAX_AGE_MS / 1000));
  return `token=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAgeSeconds}`;
}

async function main() {
  assertLocalDevelopmentConfig();
  const prisma = new PrismaClient();

  try {
    await prisma.$connect();
    const admin = await ensureLocalAdmin(prisma);
    const token = signAdminToken(admin);
    const nonce = crypto.randomBytes(24).toString('hex');
    const sessionPath = `/local-admin-session/${nonce}`;
    let consumed = false;

    const server = http.createServer((req, res) => {
      if (consumed || req.method !== 'GET' || req.url !== sessionPath) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Local admin session is unavailable.');
        return;
      }

      consumed = true;
      res.writeHead(302, {
        'Cache-Control': 'no-store',
        'Set-Cookie': sessionCookie(token),
        Location: ADMIN_REDIRECT_URL,
      });
      res.end();
      console.log('Admin cookie was issued once. Closing local session server.');
      setImmediate(() => server.close());
    });

    const expiryTimer = setTimeout(() => {
      console.error('Local admin session expired before use.');
      server.close();
    }, SESSION_TTL_MS);
    expiryTimer.unref();

    server.on('close', async () => {
      clearTimeout(expiryTimer);
      await prisma.$disconnect();
    });

    server.listen(SESSION_PORT, SESSION_HOST, () => {
      console.log(`Local ADMIN ready: ${admin.username} (${admin.id})`);
      console.log(`Open once within 2 minutes: http://localhost:${SESSION_PORT}${sessionPath}`);
      console.log('The JWT is never printed or persisted; the callback sets an HttpOnly cookie.');
    });
  } catch (error) {
    await prisma.$disconnect();
    throw error;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
