-- Stripe Connect Express columns on Instructor (independent payouts).

ALTER TABLE "Instructor" ADD COLUMN IF NOT EXISTS "stripeAccountId" TEXT;
ALTER TABLE "Instructor" ADD COLUMN IF NOT EXISTS "chargesEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Instructor" ADD COLUMN IF NOT EXISTS "payoutsEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Instructor" ADD COLUMN IF NOT EXISTS "detailsSubmitted" BOOLEAN NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS "Instructor_stripeAccountId_key"
  ON "Instructor"("stripeAccountId");
