import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/prisma/prisma.service';

/** List backup records (DB mirror), newest first, with pagination. */
@Injectable()
export class ListBackupsUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(page = 1, limit = 10) {
    const safePage = Math.max(page, 1);
    const safeLimit = Math.max(limit, 1);
    const skip = (safePage - 1) * safeLimit;

    const [items, total] = await Promise.all([
      this.prisma.backupRecord.findMany({ orderBy: { createdAt: 'desc' }, skip, take: safeLimit }),
      this.prisma.backupRecord.count(),
    ]);

    return { items, total, page: safePage, limit: safeLimit, totalPages: Math.ceil(total / safeLimit) };
  }
}
