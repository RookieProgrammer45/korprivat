-- Stripe Connect Express status columns on Organization (slice 7a).
-- stripeAccountId was already nullable; add unique + Connect capability flags.

ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "chargesEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "payoutsEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "detailsSubmitted" BOOLEAN NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS "Organization_stripeAccountId_key"
  ON "Organization"("stripeAccountId");
