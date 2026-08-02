import { PrismaService } from '../../../src/infrastructure/prisma/prisma.service';
import { assertFunctionalTestEnvironment } from './test-environment';

type TestAdmin = {
  id: string;
  tokenVersion: number;
};

/** Reset only the disposable local test database after asserting its identity. */
export async function resetFunctionalDatabase(prisma: PrismaService): Promise<void> {
  assertFunctionalTestEnvironment();
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE "User", "Patient", "Department", "AiModelRegistry", "AuditBatch" RESTART IDENTITY CASCADE',
  );
}

/** The system invariant permits exactly one administrative account in a fixture. */
export async function createAdminA(prisma: PrismaService): Promise<TestAdmin> {
  const admin = await prisma.user.create({
    data: {
      username: 'admin-a',
      email: 'admin-a@test.local',
      role: 'ADMIN',
      status: 'ACTIVE',
      firstLogin: false,
      passwordHash: '$2b$10$R4lr.r0OulcmTGZVSn79f.6gjknHhmkC2yFEsG6vQTszeDWmcjS6G',
      adminProfile: { create: { adminUserName: 'Admin A' } },
    },
  });

  return { id: admin.id, tokenVersion: admin.tokenVersion };
}

export function bearer(token: string): { Authorization: string } {
  return { Authorization: `Bearer ${token}` };
}
