-- PayoutRecord + Booking.refundedAt for Stripe Connect transfers / refunds.

ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "refundedAt" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "PayoutRecord" (
  "id" TEXT NOT NULL,
  "bookingId" TEXT NOT NULL,
  "transferId" TEXT NOT NULL,
  "recipientType" TEXT NOT NULL,
  "recipientId" TEXT NOT NULL,
  "amountSek" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'SEK',
  "status" TEXT NOT NULL DEFAULT 'sent',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PayoutRecord_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PayoutRecord_bookingId_key" ON "PayoutRecord"("bookingId");
CREATE UNIQUE INDEX IF NOT EXISTS "PayoutRecord_transferId_key" ON "PayoutRecord"("transferId");
CREATE INDEX IF NOT EXISTS "PayoutRecord_recipientType_recipientId_idx"
  ON "PayoutRecord"("recipientType", "recipientId");
