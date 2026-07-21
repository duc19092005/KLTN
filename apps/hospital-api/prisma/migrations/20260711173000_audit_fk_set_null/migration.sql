ALTER TABLE "BlockchainLogger" DROP CONSTRAINT IF EXISTS "BlockchainLogger_departmentId_fkey";
ALTER TABLE "BlockchainLogger" DROP CONSTRAINT IF EXISTS "BlockchainLogger_staffProfileId_fkey";
ALTER TABLE "BlockchainLogger" DROP CONSTRAINT IF EXISTS "BlockchainLogger_doctorProfileId_fkey";
ALTER TABLE "BlockchainLogger" DROP CONSTRAINT IF EXISTS "BlockchainLogger_aiModelRegistryId_fkey";

ALTER TABLE "BlockchainLogger" ADD CONSTRAINT "BlockchainLogger_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BlockchainLogger" ADD CONSTRAINT "BlockchainLogger_staffProfileId_fkey" FOREIGN KEY ("staffProfileId") REFERENCES "StaffProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BlockchainLogger" ADD CONSTRAINT "BlockchainLogger_doctorProfileId_fkey" FOREIGN KEY ("doctorProfileId") REFERENCES "DoctorProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BlockchainLogger" ADD CONSTRAINT "BlockchainLogger_aiModelRegistryId_fkey" FOREIGN KEY ("aiModelRegistryId") REFERENCES "AiModelRegistry"("id") ON DELETE SET NULL ON UPDATE CASCADE;
