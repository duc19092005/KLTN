ALTER TABLE "StaffProfile" ADD COLUMN "avatarUrl" TEXT;

UPDATE "StaffProfile"
SET "avatarUrl" = '/images/default-staff-avatar.png'
WHERE "avatarUrl" IS NULL;

ALTER TABLE "StaffProfile" ALTER COLUMN "avatarUrl" SET NOT NULL;
