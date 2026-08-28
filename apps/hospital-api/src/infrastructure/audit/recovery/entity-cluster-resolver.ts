import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { verifyAuditRow } from '../logging/audit-verification.util';
import { RecoverableAuditEntity } from './entity-registry.config';

type Snapshot = Record<string, unknown>;
type AnchoredAuditRow = NonNullable<Awaited<ReturnType<PrismaService['blockchainLogger']['findFirst']>>>;

@Injectable()
export class EntityClusterResolver {
  constructor(private readonly prisma: PrismaService) {}

  async resolveClusterInfo(
    entity: RecoverableAuditEntity,
    entityId: string,
    snapshot: Snapshot | null,
    row?: AnchoredAuditRow,
  ): Promise<{ clusterKey: string; clusterLabel: string }> {
    let currentSnapshot = snapshot;
    if (!currentSnapshot && row) {
      const verif = verifyAuditRow(row as any);
      if (verif.ok && (verif.decryptedAfter || verif.decryptedBefore)) {
        currentSnapshot = (verif.decryptedAfter || verif.decryptedBefore) as Snapshot;
      }
    }

    if (!currentSnapshot) return { clusterKey: entityId, clusterLabel: `${entity} (${entityId.slice(0, 8)})` };

    if (entity === 'Visit') {
      const visitCode = (currentSnapshot.visitCode as string) || entityId.slice(0, 8);
      return { clusterKey: entityId, clusterLabel: `Ca khám #${visitCode}` };
    }
    if (entity === 'MedicalConclusion' || entity === 'AiDiagnosis' || entity === 'MedicalOrder' || entity === 'MedicalResult') {
      let visitId = (currentSnapshot.visitId as string) || null;
      if (!visitId && entity === 'MedicalResult') {
        const orderId = (currentSnapshot.orderId as string) || null;
        if (orderId) {
          const orderRow = await this.prisma.blockchainLogger.findFirst({
            where: { entity: 'MedicalOrder', entityId: orderId },
            orderBy: { seq: 'desc' },
          });
          if (orderRow) {
            const orderVerif = verifyAuditRow(orderRow as any);
            if (orderVerif.ok && (orderVerif.decryptedAfter || orderVerif.decryptedBefore)) {
              const orderSnap = (orderVerif.decryptedAfter || orderVerif.decryptedBefore) as any;
              visitId = orderSnap?.visitId || null;
            }
          }
        }
      }

      if (visitId) {
        let visitCode = visitId.slice(0, 8);
        const visitRow = await this.prisma.blockchainLogger.findFirst({
          where: { entity: 'Visit', entityId: visitId },
          orderBy: { seq: 'desc' },
        });
        if (visitRow) {
          const visitVerif = verifyAuditRow(visitRow as any);
          if (visitVerif.ok && (visitVerif.decryptedAfter || visitVerif.decryptedBefore)) {
            const visitSnap = (visitVerif.decryptedAfter || visitVerif.decryptedBefore) as any;
            if (visitSnap?.visitCode) visitCode = visitSnap.visitCode;
          }
        }
        return { clusterKey: visitId, clusterLabel: `Ca khám #${visitCode}` };
      }
    }
    if (entity === 'AiQuality') {
      let visitId = (currentSnapshot.visitId as string) || null;
      const diagnosisId = (currentSnapshot.aiDiagnosisId as string) || null;
      if (!visitId && diagnosisId) {
        const diagRow = await this.prisma.blockchainLogger.findFirst({
          where: { entity: 'AiDiagnosis', entityId: diagnosisId },
          orderBy: { seq: 'desc' },
        });
        if (diagRow) {
          const diagVerif = verifyAuditRow(diagRow as any);
          if (diagVerif.ok && (diagVerif.decryptedAfter || diagVerif.decryptedBefore)) {
            const diagSnap = (diagVerif.decryptedAfter || diagVerif.decryptedBefore) as any;
            visitId = diagSnap?.visitId || null;
          }
        }
      }
      if (visitId) {
        let visitCode = visitId.slice(0, 8);
        const visitRow = await this.prisma.blockchainLogger.findFirst({
          where: { entity: 'Visit', entityId: visitId },
          orderBy: { seq: 'desc' },
        });
        if (visitRow) {
          const visitVerif = verifyAuditRow(visitRow as any);
          if (visitVerif.ok && (visitVerif.decryptedAfter || visitVerif.decryptedBefore)) {
            const visitSnap = (visitVerif.decryptedAfter || visitVerif.decryptedBefore) as any;
            if (visitSnap?.visitCode) visitCode = visitSnap.visitCode;
          }
        }
        return { clusterKey: visitId, clusterLabel: `Ca khám #${visitCode}` };
      }
      if (diagnosisId) {
        return { clusterKey: diagnosisId, clusterLabel: `Chẩn đoán AI (${diagnosisId.slice(0, 8)})` };
      }
    }
    if (entity === 'Appointment' || entity === 'Patient') {
      const patientId = (currentSnapshot.patientId as string) || entityId;
      const patientCode = (currentSnapshot.patientCode as string) || patientId.slice(0, 8);
      return { clusterKey: patientId, clusterLabel: `Hồ sơ BN #${patientCode}` };
    }
    return { clusterKey: entityId, clusterLabel: `${entity} (${entityId.slice(0, 8)})` };
  }
}