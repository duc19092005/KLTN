-- Add DEPT_SHARED role to UserRole enum
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'DEPT_SHARED';

-- Add sharedUserId column to Department
ALTER TABLE "Department" ADD COLUMN "sharedUserId" TEXT;

-- Add unique constraint
ALTER TABLE "Department" ADD CONSTRAINT "Department_sharedUserId_key" UNIQUE ("sharedUserId");

-- Add foreign key constraint
ALTER TABLE "Department" ADD CONSTRAINT "Department_sharedUserId_fkey"
  FOREIGN KEY ("sharedUserId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
