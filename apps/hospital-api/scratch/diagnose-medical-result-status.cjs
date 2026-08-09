const { PrismaClient } = require('@prisma/client');

async function checkDb(url, label) {
  console.log(`\n=================== Checking ${label} (${url}) ===================`);
  const prisma = new PrismaClient({ datasources: { db: { url } } });
  try {
    const groups = await prisma.blockchainLogger.groupBy({
      by: ['entity'],
      _count: { entity: true },
      orderBy: { _count: { entity: 'desc' } },
    });
    console.log(`Entities in ${label}:`);
    for (const g of groups) console.log(`  - ${g.entity}: ${g._count.entity}`);

    const seq96 = await prisma.blockchainLogger.findUnique({ where: { seq: 96 } });
    if (seq96) {
      console.log(`\nFOUND SEQ 96 in ${label}!`);
      console.log('Entity:', seq96.entity, 'EntityId:', seq96.entityId, 'Action:', seq96.action, 'Batch:', seq96.batchId, 'Status:', seq96.onChainStatus);
      console.log('afterJson:', seq96.afterJson);

      if (seq96.entity === 'MedicalResult') {
        const row = await prisma.medicalResult.findUnique({
          where: { id: seq96.entityId },
          include: { files: true, order: { select: { visitId: true, status: true } } },
        });
        if (row) {
          console.log('\nLive MedicalResult row in DB:');
          console.log('  id:', row.id);
          console.log('  orderId:', row.orderId);
          console.log('  order.status:', row.order?.status);
          console.log('  order.visitId:', row.order?.visitId);
          console.log('  result.status:', row.status); // Notice: undefined/null
        }
      }
    } else {
      console.log(`SEQ 96 not found in ${label}. Max seq:`);
      const max = await prisma.blockchainLogger.findFirst({ orderBy: { seq: 'desc' }, select: { seq: true, entity: true, action: true } });
      console.log('  Max seq:', max);
    }
  } catch (err) {
    console.error(`Error checking ${label}:`, err.message);
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  await checkDb('postgresql://postgres:postgres@127.0.0.1:5434/kltn_test?schema=public', 'kltn_test (5434)');
  await checkDb('postgresql://postgres:postgres@127.0.0.1:5434/zkp_identity?schema=public', 'zkp_identity (5434)');
  await checkDb('postgresql://postgres:postgres@127.0.0.1:5434/postgres?schema=public', 'postgres (5434)');
}

main();
