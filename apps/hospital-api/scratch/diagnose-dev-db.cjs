/**
 * DIAGNOSE (read-only): check port 5432 or 5434 for dev database zkp_identity.
 */
const { PrismaClient } = require('@prisma/client');

async function testUrl(url, label) {
  const prisma = new PrismaClient({ datasources: { db: { url } } });
  try {
    const count = await prisma.blockchainLogger.count();
    console.log(`\n=== Connected to ${label} (total logs: ${count}) ===`);
    const rows = await prisma.blockchainLogger.findMany({
      orderBy: { seq: 'desc' },
      take: 5,
    });
    for (const r of rows) {
      console.log(`seq: ${r.seq} | entity: ${r.entity} | action: ${r.action} | batchId: ${r.batchId}`);
      console.log(`  hashVersion: ${r.hashVersion} | beforeHash: ${r.beforeHash ? 'YES' : 'NO'} | afterHash: ${r.afterHash ? 'YES' : 'NO'} | diffHash: ${r.diffHash ? 'YES' : 'NO'} | dataHash: ${r.dataHash ? 'YES' : 'NO'}`);
    }
  } catch (err) {
    console.log(`Could not connect to ${label}:`, err.message);
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  await testUrl('postgresql://postgres:YourPassword123!@localhost:5432/zkp_identity?schema=public', 'port 5432 zkp_identity');
  await testUrl('postgresql://postgres:postgres@localhost:5434/zkp_identity?schema=public', 'port 5434 zkp_identity');
  await testUrl('postgresql://postgres:postgres@localhost:5434/kltn_dev?schema=public', 'port 5434 kltn_dev');
}

main();
