import { PrismaClient, UserRole, UserStatus } from '@prisma/client';
import * as crypto from 'crypto';

const prisma = new PrismaClient();

const departments = [
  { departmentCode: 'PB-XRAY', name: 'X-Ray', floor: '2' },
  { departmentCode: 'PB-MRI', name: 'MRI', floor: '2' },
  { departmentCode: 'PB-LAB', name: 'Blood Test', floor: '3' },
  { departmentCode: 'PB-DERM', name: 'Dermatology Lab', floor: '4' },
];

async function main() {
  for (const department of departments) {
    await prisma.department.upsert({
      where: { departmentCode: department.departmentCode },
      update: { name: department.name, floor: department.floor, status: 'ACTIVE' },
      create: { ...department, status: 'ACTIVE' },
    });
  }

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
