import { PrismaClient, UserRole, UserStatus } from '@prisma/client';
import * as crypto from 'crypto';
import {
  generateSalt,
  computeRecordHash,
  computeEntryHash,
  GENESIS_PREV_HASH,
} from '../src/infrastructure/audit/audit-hash.util';
import { buildDepartmentSnapshot } from '../src/modules/department/domain/department-snapshot';

const prisma = new PrismaClient();

const departments = [
  { departmentCode: 'PB-XRAY', name: 'X-Ray', floor: '2' },
  { departmentCode: 'PB-MRI', name: 'MRI', floor: '2' },
  { departmentCode: 'PB-LAB', name: 'Blood Test', floor: '3' },
  { departmentCode: 'PB-DERM', name: 'Dermatology Lab', floor: '4' },
];

async function main() {
  // 1. Clear old seed logs if database is reset (but keep append-only constraints in mind)
  // Clean upsert avoids breaking append-only if we just modify existing ones.
  // In seeding, we usually assume a clean database or upsert operations.

  for (const dept of departments) {
    const existing = await prisma.department.findUnique({
      where: { departmentCode: dept.departmentCode },
    });

    if (existing) {
      // If already seeded, skip or update without breaking hashes if unchanged
      console.log(`Department ${dept.departmentCode} already exists, skipping seed.`);
      continue;
    }

    // Prepare snapshots and compute integrity hashes
    const tempDept = {
      id: crypto.randomUUID(),
      departmentCode: dept.departmentCode,
      name: dept.name,
      floor: dept.floor,
      status: 'ACTIVE',
    };
    const snapshot = buildDepartmentSnapshot(tempDept);
    const salt = generateSalt();
    const hash = computeRecordHash(snapshot, salt);

    // Insert Department with integrity hashes
    const createdDept = await prisma.department.create({
      data: {
        id: tempDept.id,
        departmentCode: tempDept.departmentCode,
        name: tempDept.name,
        floor: tempDept.floor,
        status: 'ACTIVE',
        hash256: hash,
        dataSalt: salt,
      },
    });

    // Write to BlockchainLogger with hash-chain continuity
    const tail = await prisma.blockchainLogger.findFirst({
      where: { seq: { not: null } },
      orderBy: { seq: 'desc' },
      select: { seq: true, entryHash: true },
    });
    const seq = (tail?.seq ?? 0) + 1;
    const prevHash = tail?.entryHash ?? GENESIS_PREV_HASH;
    const createdAt = new Date();

    const entryHash = computeEntryHash(
      {
        seq,
        action: 'CREATE',
        entity: 'Department',
        entityId: createdDept.id,
        dataHash: hash,
        createdAtIso: createdAt.toISOString(),
      },
      prevHash
    );

    await prisma.blockchainLogger.create({
      data: {
        seq,
        prevHash,
        entryHash,
        entity: 'Department',
        entityId: createdDept.id,
        action: 'CREATE',
        dataHash: hash,
        dataSalt: salt,
        afterJson: snapshot as any,
        onChainStatus: 'PENDING',
        createdAt,
      },
    });

    console.log(`Seeded & Logged Department: ${dept.departmentCode}`);
  }

  // Seed default admin user
  const rawInviteToken = process.env.SEED_ADMIN_INVITE_TOKEN || 'admin-bootstrap-token';
  const inviteToken = `sha256:${crypto.createHash('sha256').update(rawInviteToken).digest('hex')}`;

  await prisma.user.upsert({
    where: { username: 'admin' },
    update: { role: UserRole.ADMIN, status: UserStatus.PENDING },
    create: {
      username: 'admin',
      email: 'admin@hospital.local',
      role: UserRole.ADMIN,
      status: UserStatus.PENDING,
      firstLogin: true,
      inviteToken,
      inviteTokenExpiry: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      adminProfile: {
        create: {
          adminUserName: 'admin',
        },
      },
    },
  });

  console.log('Seed completed. Default admin invite token:', rawInviteToken);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
