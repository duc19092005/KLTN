import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/prisma/prisma.service';
import { AuthUser } from '../../../../common/types/auth-user.type';
import { AuditPresenter } from '../presenters/audit.presenter';
import { AuditSubjectResolverService } from '../services/audit-subject-resolver.service';

export interface ListAuditLogsQueryDto {
  entity?: string;
  entityId?: string;
  q?: string;
  action?: string;
  actorId?: string;
  from?: string;
  to?: string;
  verificationStatus?: string;
  batch?: string;
  sort?: string;
  page?: string;
  limit?: string;
}

@Injectable()
export class ListAuditLogsQuery {
  constructor(
    private readonly prisma: PrismaService,
    private readonly presenter: AuditPresenter,
    private readonly resolver: AuditSubjectResolverService,
  ) {}

  async execute(params: ListAuditLogsQueryDto, user?: AuthUser) {
    const page = Math.max(Number(params.page) || 1, 1);
    const limit = Math.min(Math.max(Number(params.limit) || 10, 1), 100);
    const skip = (page - 1) * limit;
    const sort: 'asc' | 'desc' = params.sort === 'asc' ? 'asc' : 'desc';

    const where: any = {};
    if (params.entity) where.entity = params.entity;
    if (params.entityId?.trim()) where.entityId = params.entityId.trim();
    if (params.action) where.action = params.action;
    if (params.actorId) where.actorId = params.actorId;
    if (params.verificationStatus) where.onChainStatus = params.verificationStatus;
    const from = params.from ? new Date(params.from) : null;
    const to = params.to ? new Date(params.to) : null;
    if ((from && !Number.isNaN(from.getTime())) || (to && !Number.isNaN(to.getTime()))) {
      where.createdAt = {
        ...(from && !Number.isNaN(from.getTime()) ? { gte: from } : {}),
        ...(to && !Number.isNaN(to.getTime()) ? { lte: to } : {}),
      };
    }
    if (params.batch !== undefined && params.batch !== '' && Number.isFinite(Number(params.batch))) {
      where.batchId = Number(params.batch);
    }

    const q = params.q?.trim();
    if (q) {
      const subjectFilters = await this.resolver.buildSubjectSearchFilters(q);
      where.AND = [
        ...(where.AND || []),
        {
          OR: [
            { entityId: q },
            { entityId: { contains: q, mode: 'insensitive' } },
            { action: { contains: q, mode: 'insensitive' } },
            { entity: { contains: q, mode: 'insensitive' } },
            ...subjectFilters,
          ],
        },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.blockchainLogger.findMany({
        where,
        orderBy: { seq: sort },
        skip,
        take: limit,
      }),
      this.prisma.blockchainLogger.count({ where }),
    ]);

    const actorIds = [...new Set(items.map((r) => r.actorId).filter((id): id is string => Boolean(id)))];
    const actors = actorIds.length
      ? await this.prisma.user.findMany({
          where: { id: { in: actorIds } },
          select: {
            id: true,
            username: true,
            email: true,
            role: true,
            staffProfile: { select: { fullName: true } },
            adminProfile: { select: { adminUserName: true } },
          },
        })
      : [];
    const actorMap = new Map(actors.map((a) => [a.id, a]));
    const subjectMap = await this.resolver.resolveSubjectContextMap(items);

    const itemsWithStatus = items.map((row) => {
      const actor = row.actorId ? actorMap.get(row.actorId) : null;
      return this.presenter.presentAuditRow(row, actor, user, false, false, subjectMap.get(this.resolver.subjectKey(row)) ?? null);
    });

    return {
      items: itemsWithStatus,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getLogDetail(seq: number, user?: AuthUser) {
    const row = await this.prisma.blockchainLogger.findFirst({ where: { seq } });
    if (!row) throw new NotFoundException('Không tìm thấy audit log.');

    const actor = row.actorId
      ? await this.prisma.user.findUnique({
          where: { id: row.actorId },
          select: {
            id: true,
            username: true,
            email: true,
            role: true,
            staffProfile: { select: { fullName: true } },
            adminProfile: { select: { adminUserName: true } },
          },
        })
      : null;

    const subject = await this.resolver.resolveSubjectContext(row);
    return this.presenter.presentAuditRow(row, actor, user, true, false, subject);
  }
}