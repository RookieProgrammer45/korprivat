-- AlterEnum
ALTER TYPE "LicenseStatus" ADD VALUE IF NOT EXISTS 'EXPIRED';

-- AlterTable
ALTER TABLE "instructor_license" ADD COLUMN IF NOT EXISTS "expiresAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "instructor_license_expiresAt_idx" ON "instructor_license"("expiresAt");
