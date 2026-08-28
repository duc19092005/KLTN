import { Prisma, PrismaClient } from '@prisma/client';

export type TxClient = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'> | Prisma.TransactionClient;

export async function generatePatientCode(tx: TxClient): Promise<string> {
  const latest = await tx.patient.findFirst({ where: { patientCode: { startsWith: 'BN-' } }, orderBy: { patientCode: 'desc' }, select: { patientCode: true } });
  const lastNumber = Number(latest?.patientCode?.replace('BN-', '') || '0');
  return `BN-${String(lastNumber + 1).padStart(4, '0')}`;
}

export async function generateVisitCode(tx: TxClient): Promise<string> {
  const latest = await tx.visit.findFirst({ where: { visitCode: { startsWith: 'VISIT-' } }, orderBy: { visitCode: 'desc' }, select: { visitCode: true } });
  const lastNumber = Number(latest?.visitCode?.replace('VISIT-', '') || '0');
  return `VISIT-${String(lastNumber + 1).padStart(4, '0')}`;
}

export async function generateAppointmentCode(tx: TxClient): Promise<string> {
  const prefix = `AP-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-`;
  const latest = await tx.appointment.findFirst({ where: { appointmentCode: { startsWith: prefix } }, orderBy: { appointmentCode: 'desc' }, select: { appointmentCode: true } });
  const lastNumber = Number(latest?.appointmentCode?.replace(prefix, '') || '0');
  return `${prefix}${String(lastNumber + 1).padStart(4, '0')}`;
}