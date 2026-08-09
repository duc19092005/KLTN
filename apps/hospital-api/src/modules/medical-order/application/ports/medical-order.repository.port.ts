import { MedicalOrderStatus, Prisma } from '@prisma/client';

/** DI token for the medical order repository port. */
export const MEDICAL_ORDER_REPOSITORY = Symbol('MEDICAL_ORDER_REPOSITORY');

/** Minimal visit shape needed to validate order creation. */
export type OrderVisitInfo = {
  id: string;
  patientId: string;
  departmentId: string;
  staffId: string | null;
  status: string;
};

export type DoctorStaffIdentity = {
  doctorId: string;
  staffId: string;
  departmentId: string | null;
};

export type CreateOrderCommand = {
  visitId: string;
  patientId: string;
  doctorId: string;
  staffId?: string;
  targetDepartmentId?: string | null;
  orderType: string;
  priority?: string;
  clinicalNote?: string;
};

export type OrderListFilter = {
  status?: MedicalOrderStatus;
  visitId?: string;
  targetDepartmentId?: string;
  doctorId?: string;
};

export type CreateResultFileData = {
  fileName: string;
  originalName: string;
  mimeType: string;
  size: number;
  url?: string | null;
  storageProvider: string;
  bucket?: string | null;
  objectKey?: string | null;
  sha256?: string | null;
  etag?: string | null;
};

export type CreatedOrderRecord = {
  id: string;
  orderCode: string;
  visitId: string;
  patientId: string;
  doctorId: string;
  targetDepartmentId: string | null;
  orderType: string;
  priority: string;
  status: MedicalOrderStatus;
  clinicalNote: string | null;
};

/**
 * Full MedicalOrder fields required by EntityRecoveryService
 * (REQUIRED_SNAPSHOT_FIELDS.MedicalOrder). Consumed by `buildMedicalOrderSnapshot`.
 */
export type OrderStatusUpdatedRecord = CreatedOrderRecord;

/**
 * Full Visit fields required by EntityRecoveryService for the `Visit` entity
 * (REQUIRED_SNAPSHOT_FIELDS.Visit). This is the canonical shape consumed by
 * `buildVisitSnapshot`.
 */
export type VisitAuditSnapshotData = {
  id: string;
  visitCode: string;
  patientId: string;
  departmentId: string;
  staffId: string | null;
  status: string;
  source: string;
  checkInAt: Date | string;
  completedAt: Date | string | null;
};

export type OrderCreatedHook = (
  order: CreatedOrderRecord,
  visitAfter: VisitAuditSnapshotData,
  tx: Prisma.TransactionClient,
) => Promise<void>;

export type OrderStatusUpdatedHook = (
  order: OrderStatusUpdatedRecord,
  tx: Prisma.TransactionClient,
) => Promise<void>;

export type CreateResultCommand = {
  orderId: string;
  performedById: string;
  note?: string;
  files: CreateResultFileData[];
};

/** Order with the targetDepartmentId needed for access checks. */
export type OrderForAccess = { targetDepartmentId: string | null };

/** Result file joined with its owning order, for download authorization. */
export type ResultFileWithOrder = {
  id: string;
  fileName: string;
  originalName: string;
  mimeType: string;
  url: string | null;
  storageProvider: string;
  bucket: string | null;
  objectKey: string | null;
  order: { id: string; doctorId: string; targetDepartmentId: string | null };
} | null;

export type StaffIdentity = { id: string; userId?: string; departmentId: string | null };

export type OrderDepartmentInfo = {
  id: string;
  type: string;
  status: string;
  canReceiveOrders: boolean;
};

export type CreateResultTransactionPayload = {
  result: unknown;
  order: unknown;
  visitTransition: { visit: VisitAuditSnapshotData; previousStatus: string } | null;
};

/**
 * Persistence boundary for the MedicalOrder aggregate. The Prisma implementation
 * keeps the include shapes, code generation, and multi-step transactions
 * (order+visit transition, result+order+visit transition) unchanged.
 */
export interface MedicalOrderRepositoryPort {
  findVisitForOrder(visitId: string): Promise<OrderVisitInfo | null>;
  findDoctorIdByUserId(userId: string): Promise<string | null>;
  findDoctorStaffByUserId(userId: string): Promise<DoctorStaffIdentity | null>;
  findStaffByUserId(userId: string): Promise<StaffIdentity | null>;
  findOrderDepartment(id: string): Promise<OrderDepartmentInfo | null>;

  departmentExists(id: string): Promise<boolean>;

  /** Atomic: generate unique order code, create order, transition visit to WAITING_TEST_RESULT (with retry). */
  createOrderWithVisitTransition(command: CreateOrderCommand, onCreated?: OrderCreatedHook): Promise<unknown>;

  findAll(filter: OrderListFilter): Promise<unknown[]>;

  findOrderForManage(id: string): Promise<({ id: string } & OrderForAccess & { status: MedicalOrderStatus; visitId: string; orderType: string }) | null>;

  updateStatus(id: string, status: MedicalOrderStatus, completedAt?: Date, afterWrite?: OrderStatusUpdatedHook): Promise<unknown>;

  /** Atomic: create result+files, set order RESULT_READY, and transition visit to WAITING_CONCLUSION when all ready. */
  createResultWithTransitions(
    command: CreateResultCommand,
    visitId: string,
    afterWrite?: (payload: CreateResultTransactionPayload, tx: Prisma.TransactionClient) => Promise<void>,
  ): Promise<unknown>;

  findResultFileWithOrder(fileId: string): Promise<ResultFileWithOrder>;
}
