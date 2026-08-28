import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/prisma/prisma.service';

@Injectable()
export class AuditSubjectResolverService {
  constructor(private readonly prisma: PrismaService) {}

  subjectKey(row: { entity: string; entityId?: string | null }) {
    return `${row.entity}:${row.entityId ?? ''}`;
  }

  async resolveSubjectContextMap(rows: Array<{ entity: string; entityId?: string | null }>) {
    const map = new Map<string, any>();
    const uniqueRows = Array.from(new Map(rows.filter((row) => row.entityId).map((row) => [this.subjectKey(row), row])).values());
    await Promise.all(uniqueRows.map(async (row) => {
      const subject = await this.resolveSubjectContext(row);
      if (subject) map.set(this.subjectKey(row), subject);
    }));
    return map;
  }

  async resolveSubjectContext(row: { entity: string; entityId?: string | null }) {
    if (!row.entityId) return null;
    const base = {
      entity: row.entity,
      entityId: row.entityId,
      table: row.entity,
      label: row.entity,
      code: null as string | null,
      displayName: null as string | null,
      linkedUserId: null as string | null,
      departmentId: null as string | null,
      departmentName: null as string | null,
      patientId: null as string | null,
      visitId: null as string | null,
    };

    if (row.entity === 'Patient') {
      return { ...base, label: 'Patient record', displayName: 'Protected medical subject', patientId: row.entityId };
    }
    if (row.entity === 'Visit') {
      return { ...base, label: 'Visit', displayName: 'Protected medical visit', visitId: row.entityId };
    }
    if (row.entity === 'MedicalConclusion' || row.entity === 'MedicalResult' || row.entity === 'MedicalOrder') {
      return { ...base, label: row.entity, displayName: 'Protected clinical record' };
    }

    if (row.entity === 'StaffProfile') {
      const staff = await this.prisma.staffProfile.findUnique({
        where: { id: row.entityId },
        select: { id: true, userId: true, fullName: true, employeeCode: true, departmentId: true, department: { select: { name: true } } },
      });
      if (!staff) return base;
      return { ...base, label: 'Nhân sự', code: staff.employeeCode, displayName: staff.fullName, linkedUserId: staff.userId, departmentId: staff.departmentId, departmentName: staff.department?.name ?? null };
    }

    if (row.entity === 'Department') {
      const department = await this.prisma.department.findUnique({
        where: { id: row.entityId },
        select: { id: true, departmentCode: true, name: true },
      });
      if (!department) return base;
      return { ...base, label: 'Phòng ban', code: department.departmentCode, displayName: department.name, departmentId: department.id, departmentName: department.name };
    }

    return base;
  }

  async buildSubjectSearchFilters(q: string): Promise<Array<Record<string, unknown>>> {
    const filters: Array<Record<string, unknown>> = [];
    const [departments, staffs, aiModels] = await Promise.all([
      this.prisma.department.findMany({
        where: {
          OR: [
            { departmentCode: { contains: q, mode: 'insensitive' } },
            { name: { contains: q, mode: 'insensitive' } },
          ],
        },
        select: { id: true },
        take: 40,
      }),
      this.prisma.staffProfile.findMany({
        where: {
          OR: [
            { fullName: { contains: q, mode: 'insensitive' } },
            { employeeCode: { contains: q, mode: 'insensitive' } },
          ],
        },
        select: { id: true },
        take: 40,
      }),
      this.prisma.aiModelRegistry.findMany({
        where: {
          OR: [
            { modelName: { contains: q, mode: 'insensitive' } },
            { modelId: { contains: q, mode: 'insensitive' } },
          ],
        },
        select: { id: true },
        take: 40,
      }),
    ]);

    if (departments.length) {
      filters.push({ entity: 'Department', entityId: { in: departments.map((d) => d.id) } });
    }
    if (staffs.length) {
      filters.push({ entity: 'StaffProfile', entityId: { in: staffs.map((s) => s.id) } });
    }
    if (aiModels.length) {
      filters.push({ entity: 'AiModelRegistry', entityId: { in: aiModels.map((m) => m.id) } });
    }
    return filters;
  }

  async resolveSampleLabels(entity: string, ids: string[]): Promise<string[]> {
    if (!ids.length) return [];
    if (entity === 'Department') {
      const rows = await this.prisma.department.findMany({
        where: { id: { in: ids } },
        select: { departmentCode: true, name: true },
      });
      return rows.map((r) => `${r.departmentCode} · ${r.name}`);
    }
    if (entity === 'StaffProfile') {
      const rows = await this.prisma.staffProfile.findMany({
        where: { id: { in: ids } },
        select: { employeeCode: true, fullName: true },
      });
      return rows.map((r) => `${r.employeeCode || 'NV'} · ${r.fullName}`);
    }
    if (entity === 'AiModelRegistry') {
      const rows = await this.prisma.aiModelRegistry.findMany({
        where: { id: { in: ids } },
        select: { modelName: true, modelVersion: true },
      });
      return rows.map((r) => `${r.modelName} v${r.modelVersion}`);
    }
    if (entity === 'Visit' || entity === 'Patient' || entity === 'MedicalConclusion' || entity === 'MedicalResult' || entity === 'MedicalOrder') {
      return ids.map((id) => `${entity} ${id.slice(0, 8)}…`);
    }
    return ids.map((id) => id.slice(0, 10));
  }
}