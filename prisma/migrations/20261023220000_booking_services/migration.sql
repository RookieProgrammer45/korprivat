-- Scheduling context: canonical transitions, draft-capable cancellation
-- policies, payment records, and ops tasks. Empty tables only.

CREATE TABLE "BookingStateTransition" (
  "id" TEXT NOT NULL,
  "bookingId" TEXT NOT NULL,
  "fromState" TEXT,
  "toState" TEXT NOT NULL,
  "actor" TEXT NOT NULL,
  "correlationId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BookingStateTransition_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "BookingStateTransition_bookingId_createdAt_idx" ON "BookingStateTransition"("bookingId", "createdAt");

CREATE TABLE "CancellationPolicy" (
  "id" TEXT NOT NULL,
  "listingId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "deadlineType" TEXT NOT NULL,
  "deadlineValue" JSONB NOT NULL,
  "timezone" TEXT NOT NULL,
  "businessCalendar" JSONB NOT NULL,
  "wording" TEXT,
  "source" TEXT NOT NULL,
  "approvedAt" TIMESTAMP(3),
  "state" TEXT NOT NULL,
  "activeListingKey" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CancellationPolicy_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CancellationPolicy_listingId_version_key" ON "CancellationPolicy"("listingId", "version");
CREATE UNIQUE INDEX "CancellationPolicy_activeListingKey_key" ON "CancellationPolicy"("activeListingKey");
CREATE INDEX "CancellationPolicy_listingId_state_idx" ON "CancellationPolicy"("listingId", "state");

CREATE TABLE "PaymentRecord" (
  "id" TEXT NOT NULL,
  "bookingId" TEXT NOT NULL,
  "state" TEXT NOT NULL,
  "lateCaptured" BOOLEAN NOT NULL DEFAULT false,
  "amountMinor" INTEGER,
  "currency" TEXT NOT NULL DEFAULT 'SEK',
  "stripeEventId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PaymentRecord_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PaymentRecord_stripeEventId_key" ON "PaymentRecord"("stripeEventId");
CREATE INDEX "PaymentRecord_bookingId_idx" ON "PaymentRecord"("bookingId");

CREATE TABLE "OpsTask" (
  "id" TEXT NOT NULL,
  "bookingId" TEXT,
  "kind" TEXT NOT NULL,
  "allowedActions" TEXT[],
  "state" TEXT NOT NULL DEFAULT 'open',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OpsTask_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "OpsTask_bookingId_idx" ON "OpsTask"("bookingId");

ALTER TABLE "Booking" ADD COLUMN "commitmentRoute" TEXT;
ALTER TABLE "Booking" ADD COLUMN "cancellationDeadlineAt" TIMESTAMP(3);

ALTER TABLE "BookingStateTransition" ADD CONSTRAINT "BookingStateTransition_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CancellationPolicy" ADD CONSTRAINT "CancellationPolicy_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Instructor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PaymentRecord" ADD CONSTRAINT "PaymentRecord_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
