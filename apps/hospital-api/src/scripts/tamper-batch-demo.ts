import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const batch1 = await prisma.auditBatch.findUnique({ where: { batchId: 1 } });
  if (!batch1) {
    console.log('⚠️ Không tìm thấy Batch #1 trong DB local.');
    return;
  }

  console.log(`📌 Merkle Root hiện tại của Batch #1: ${batch1.merkleRoot}`);

  const tamperedRoot = 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';
  await prisma.auditBatch.update({
    where: { batchId: 1 },
    data: { merkleRoot: tamperedRoot },
  });

  console.log(`💥 ĐÃ GIẢ MẠO THÀNH CÔNG Merkle Root của Batch #1 thành: ${tamperedRoot}`);
  console.log('👉 Bây giờ bạn hãy mở web Admin -> Bấm "Kiểm tra chi tiết từng Batch" để kiểm tra đối soát!');
}

main()
  .catch((err) => {
    console.error('❌ Lỗi:', err);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
