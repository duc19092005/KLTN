/**
 * Builds the relation shape required by the staff integrity snapshot without
 * mutating the Prisma result that will later be returned by the API.
 */
export function toStaffAuditProfile<T extends object>(
  staffProfile: T,
  user: { status?: unknown },
): T & { user: { status: unknown | null } } {
  return {
    ...staffProfile,
    user: { status: user.status ?? null },
  };
}
