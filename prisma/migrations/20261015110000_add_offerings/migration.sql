-- Marketplace offerings: packages/intensive courses (Offering) and learner
-- "request to book" rows (OfferingRequest). Additive, no data loss.
CREATE TABLE IF NOT EXISTS "Offering" (
    "id" TEXT NOT NULL,
    "instructorId" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'PAKET',
    "name" TEXT NOT NULL,
    "description" TEXT,
    "priceSek" INTEGER NOT NULL,
    "sessions" INTEGER,
    "weeks" INTEGER,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Offering_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "OfferingRequest" (
    "id" TEXT NOT NULL,
    "offeringId" TEXT NOT NULL,
    "offeringName" TEXT NOT NULL,
    "offeringPriceSek" INTEGER NOT NULL,
    "instructorId" TEXT NOT NULL,
    "studentName" TEXT NOT NULL,
    "studentEmail" TEXT NOT NULL,
    "studentPhone" TEXT NOT NULL,
    "preferredStart" TEXT,
    "message" TEXT,
    "status" TEXT NOT NULL DEFAULT 'new',
    "locale" TEXT NOT NULL DEFAULT 'sv',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OfferingRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Offering_instructorId_active_idx"
  ON "Offering"("instructorId", "active");

CREATE INDEX IF NOT EXISTS "OfferingRequest_instructorId_idx"
  ON "OfferingRequest"("instructorId");

CREATE INDEX IF NOT EXISTS "OfferingRequest_offeringId_idx"
  ON "OfferingRequest"("offeringId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Offering_instructorId_fkey'
  ) THEN
    ALTER TABLE "Offering" ADD CONSTRAINT "Offering_instructorId_fkey"
      FOREIGN KEY ("instructorId") REFERENCES "Instructor"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;
