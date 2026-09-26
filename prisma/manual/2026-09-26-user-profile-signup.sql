-- Manual Neon apply when `prisma db push` cannot reach the project.
-- Safe / idempotent: ADD COLUMN IF NOT EXISTS.

ALTER TABLE "user_profile" ADD COLUMN IF NOT EXISTS "signupPath" TEXT;
ALTER TABLE "user_profile" ADD COLUMN IF NOT EXISTS "dateOfBirth" TIMESTAMP(3);
ALTER TABLE "user_profile" ADD COLUMN IF NOT EXISTS "phone" TEXT;
ALTER TABLE "user_profile" ADD COLUMN IF NOT EXISTS "city" TEXT;
ALTER TABLE "user_profile" ADD COLUMN IF NOT EXISTS "schoolName" TEXT;
ALTER TABLE "user_profile" ADD COLUMN IF NOT EXISTS "organizationNumber" TEXT;
ALTER TABLE "user_profile" ADD COLUMN IF NOT EXISTS "licenseHeldYears" INTEGER;
ALTER TABLE "user_profile" ADD COLUMN IF NOT EXISTS "ageEstimatedYears" DOUBLE PRECISION;
ALTER TABLE "user_profile" ADD COLUMN IF NOT EXISTS "ageCheckRequestId" TEXT;
ALTER TABLE "user_profile" ADD COLUMN IF NOT EXISTS "ageCheckStatus" TEXT;

CREATE INDEX IF NOT EXISTS "user_profile_signupPath_idx" ON "user_profile"("signupPath");
