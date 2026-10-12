-- Additive only: preserve all historical USD amounts and leave unknown SEK values NULL.
-- Apply in the approved deployment workflow before running the new application code.
ALTER TABLE "LateCancellationFee" ADD COLUMN "amountSek" INTEGER;
