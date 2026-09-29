-- Direct Stripe Checkout idempotency columns on Booking.
-- Partial unique index so multiple unpaid (NULL) rows remain valid.

ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "stripeSessionId" TEXT;
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "paidAt" TIMESTAMP(3);

CREATE UNIQUE INDEX IF NOT EXISTS "Booking_stripeSessionId_key"
  ON "Booking"("stripeSessionId")
  WHERE "stripeSessionId" IS NOT NULL;
