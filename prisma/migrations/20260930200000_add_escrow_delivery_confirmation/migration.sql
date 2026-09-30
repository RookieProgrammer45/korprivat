-- Escrow delivery-confirmation timestamps (buyer confirm / auto-release / dispute).
-- paymentStatus string values (no enum migration):
--   awaiting_buyer_confirmation | release_ready | disputed | payout_pending | payout_failed

ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "deliveredAt" TIMESTAMP(3);
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "confirmedAt" TIMESTAMP(3);
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "autoReleaseAt" TIMESTAMP(3);
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "disputeOpenedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "Booking_autoReleaseAt_paymentStatus_idx"
  ON "Booking"("autoReleaseAt", "paymentStatus");
