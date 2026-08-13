/**
 * DIAGNOSE (read-only): kiểm tra SEQ 126 và SEQ 127 trong DB kltn_test (hoặc dev).
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({ datasources: { db: { url: 'postgresql://postgres:postgres@127.0.0.1:5434/kltn_test?schema=public' } } });

async function main() {
  const rows = await prisma.blockchainLogger.findMany({
    where: { seq: { in: [126, 127] } },
  });
  console.log('=== SEQ 126 & 127 rows ===');
  for (const r of rows) {
    console.log(`seq: ${r.seq} | entity: ${r.entity} | action: ${r.action} | batchId: ${r.batchId}`);
    console.log(`  hashVersion: ${r.hashVersion}`);
    console.log(`  beforeHash: ${r.beforeHash}`);
    console.log(`  afterHash: ${r.afterHash}`);
    console.log(`  diffHash: ${r.diffHash}`);
    console.log(`  dataHash: ${r.dataHash}`);
    console.log(`  entryHash: ${r.entryHash}`);
    console.log(`  beforeEncrypted: ${r.beforeEncrypted ? 'YES' : 'NO'}`);
    console.log(`  afterEncrypted: ${r.afterEncrypted ? 'YES' : 'NO'}`);
  }

  const maxSeq = await prisma.blockchainLogger.findFirst({ orderBy: { seq: 'desc' } });
  console.log('\nMax seq in DB:', maxSeq?.seq);
}

main().catch(console.error).finally(() => prisma.$disconnect());
