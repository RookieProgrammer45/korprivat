-- Reliability context. Empty tables. No booking or payment changes.

CREATE TABLE "SchoolConnection" (
  "id" TEXT NOT NULL,
  "listingId" TEXT NOT NULL,
  "environment" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'inactive',
  "eventWatermarkRevision" INTEGER,
  "eventWatermarkAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SchoolConnection_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SchoolConnection_listingId_environment_key" ON "SchoolConnection"("listingId", "environment");
CREATE INDEX "SchoolConnection_listingId_idx" ON "SchoolConnection"("listingId");

CREATE TABLE "BookingEvent" (
  "id" TEXT NOT NULL,
  "schoolConnectionId" TEXT NOT NULL,
  "providerEventId" TEXT NOT NULL,
  "externalRef" TEXT,
  "eventType" TEXT NOT NULL,
  "payloadHash" TEXT NOT NULL,
  "revision" INTEGER,
  "occurredAt" TIMESTAMP(3),
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processingStatus" TEXT NOT NULL,
  "disposition" TEXT,
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "deadLetterAt" TIMESTAMP(3),
  "redactedPayload" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BookingEvent_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "BookingEvent_schoolConnectionId_providerEventId_key" ON "BookingEvent"("schoolConnectionId", "providerEventId");
CREATE INDEX "BookingEvent_schoolConnectionId_receivedAt_idx" ON "BookingEvent"("schoolConnectionId", "receivedAt");

CREATE TABLE "CommandOutbox" (
  "id" TEXT NOT NULL,
  "commandType" TEXT NOT NULL,
  "schoolConnectionId" TEXT,
  "bookingId" TEXT,
  "correlationId" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "state" TEXT NOT NULL DEFAULT 'pending',
  "outcome" TEXT NOT NULL DEFAULT 'pending',
  "quarantineResourceRef" TEXT,
  "quarantineStartsAt" TIMESTAMP(3),
  "quarantineEndsAt" TIMESTAMP(3),
  "resolutionRef" TEXT,
  "resolutionKind" TEXT,
  "resolutionRationale" TEXT,
  "leaseExpiresAt" TIMESTAMP(3),
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "nextRetryAt" TIMESTAMP(3),
  "deadLetterAt" TIMESTAMP(3),
  "redactedPayload" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CommandOutbox_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CommandOutbox_idempotencyKey_key" ON "CommandOutbox"("idempotencyKey");
CREATE INDEX "CommandOutbox_state_nextRetryAt_idx" ON "CommandOutbox"("state", "nextRetryAt");
CREATE INDEX "CommandOutbox_bookingId_idx" ON "CommandOutbox"("bookingId");
CREATE INDEX "CommandOutbox_schoolConnectionId_idx" ON "CommandOutbox"("schoolConnectionId");

ALTER TABLE "SchoolConnection" ADD CONSTRAINT "SchoolConnection_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Instructor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BookingEvent" ADD CONSTRAINT "BookingEvent_schoolConnectionId_fkey" FOREIGN KEY ("schoolConnectionId") REFERENCES "SchoolConnection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CommandOutbox" ADD CONSTRAINT "CommandOutbox_schoolConnectionId_fkey" FOREIGN KEY ("schoolConnectionId") REFERENCES "SchoolConnection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CommandOutbox" ADD CONSTRAINT "CommandOutbox_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
