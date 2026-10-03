-- Payments context: append-only Stripe webhook idempotency ledger.
CREATE TABLE IF NOT EXISTS "stripe_webhook_event" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "stripe_webhook_event_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "stripe_webhook_event_eventId_key"
  ON "stripe_webhook_event"("eventId");

CREATE INDEX IF NOT EXISTS "stripe_webhook_event_eventType_receivedAt_idx"
  ON "stripe_webhook_event"("eventType", "receivedAt");
