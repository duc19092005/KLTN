import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...');

  // ============================================================
  // Admin: NO seed data. Super Admin creates Admin accounts
  // via the API with invite tokens. This is intentional security.
  // ============================================================
  console.log('ℹ️  Admin accounts: Not seeded. Super Admin creates via API with invite tokens.');





  console.log('\n🌱 Seeding finished successfully!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📋 Summary:');
  console.log('   - Admins: None (create via Super Admin API)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
