/**
 * DIAGNOSE 2 (read-only): tìm entity names thực tế + audit row SEQ 96.
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({ datasources: { db: { url: 'postgresql://postgres:postgres@127.0.0.1:5434/kltn_test?schema=public' } } });

async function main() {
  // 1) Tất cả entity names có trong blockchainLogger
  const groups = await prisma.blockchainLogger.groupBy({
    by: ['entity'],
    _count: { entity: true },
    orderBy: { _count: { entity: 'desc' } },
  });
  console.log('=== Entity names trong BlockchainLogger ===');
  for (const g of groups) console.log(g.entity, '->', g._count.entity);

  // 2) Dòng SEQ 96 (bản ghi lỗi mới nhất trên UI)
  const seq96 = await prisma.blockchainLogger.findUnique({ where: { seq: 96 } });
  if (seq96) {
    console.log('\n=== SEQ 96 ===');
    console.log('entity:', seq96.entity, '| entityId:', seq96.entityId, '| action:', seq96.action);
    console.log('afterJson:', seq96.afterJson);
  } else {
    console.log('\nKhông có SEQ 96. Các SEQ gần đây:');
    const recent = await prisma.blockchainLogger.findMany({ orderBy: { seq: 'desc' }, take: 10, select: { seq: true, entity: true, entityId: true, action: true, onChainStatus: true, batchId: true } });
    for (const r of recent) console.log(r.seq, r.entity, r.entityId, r.action, r.onChainStatus, 'batch', r.batchId);
  }
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
