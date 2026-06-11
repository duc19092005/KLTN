/**
 * Registry mapping an audited entity label (as stored in BlockchainLogger.entity) to the
 * information needed to (a) read its current business snapshot and (b) re-apply a known-good
 * snapshot during surgical recovery.
 *
 * Surgical recovery never rolls the whole DB back. Instead it takes the last anchored, verified
 * snapshot of ONE tampered record (afterJson from the BlockchainLogger entry whose dataHash matches
 * the on-chain Merkle root) and writes exactly those business fields back, leaving every other row —
 * including all legitimate changes made after the tamper — untouched.
 *
 * Only entities that carry an integrity hash (hash256/dataSalt) and a snapshot are restorable.
 */
export interface EntityRestoreSpec {
  /** Prisma model delegate name, e.g. 'patient', 'department'. */
  prismaModel: string;
  /** Convert a stored snapshot (afterJson) into a Prisma update payload (handles type coercion). */
  toUpdateData: (snapshot: Record<string, any>) => Record<string, any>;
}

/** Coerce an ISO string (or Date) back into a Date for Prisma DateTime columns. */
function toDate(v: any): Date | undefined {
  if (v === null || v === undefined) return undefined;
  return v instanceof Date ? v : new Date(v);
}

export const ENTITY_RESTORE_REGISTRY: Record<string, EntityRestoreSpec> = {
  Patient: {
    prismaModel: 'patient',
    toUpdateData: (s) => ({
      fullName: s.fullName,
      gender: s.gender,
      birthDate: toDate(s.birthDate),
      citizenId: s.citizenId ?? null,
      phone: s.phone ?? null,
      address: s.address ?? null,
      insuranceNumber: s.insuranceNumber ?? null,
      emergencyContact: s.emergencyContact ?? null,
    }),
  },
  Department: {
    prismaModel: 'department',
    toUpdateData: (s) => ({
      name: s.name,
      floor: s.floor ?? null,
      status: s.status,
      type: s.type,
      canReceiveOrders: s.canReceiveOrders,
      description: s.description ?? null,
      specialty: s.specialty ?? null,
    }),
  },
  StaffProfile: {
    prismaModel: 'staffProfile',
    toUpdateData: (s) => ({
      fullName: s.fullName,
      phone: s.phone,
      gender: s.gender,
      citizenId: s.citizenId,
      birthDate: toDate(s.birthDate),
      address: s.address ?? null,
      position: s.position ?? null,
    }),
  },
  MedicalConclusion: {
    prismaModel: 'medicalConclusion',
    toUpdateData: (s) => ({
      finalDiagnosis: s.finalDiagnosis,
      treatmentPlan: s.treatmentPlan ?? null,
      prescription: s.prescription ?? null,
      followUpNote: s.followUpNote ?? null,
      doctorNote: s.doctorNote ?? null,
    }),
  },
};

/** Whether surgical restore knows how to re-apply a snapshot for this entity label. */
export function isRestorable(entity: string): boolean {
  return entity in ENTITY_RESTORE_REGISTRY;
}
