-- Category teaching permissions and immutable booking snapshots.
-- Offering and Booking tables are unchanged.

CREATE TABLE "TeachingPermission" (
  "id" TEXT NOT NULL,
  "listingId" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "legalEntityRef" TEXT NOT NULL,
  "locationRef" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'CURRENT',
  "evidenceRef" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TeachingPermission_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "TeachingPermission_listingId_category_idx" ON "TeachingPermission"("listingId", "category");
ALTER TABLE "TeachingPermission" ADD CONSTRAINT "TeachingPermission_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Instructor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "CategoryOffering" (
  "id" TEXT NOT NULL,
  "offeringId" TEXT NOT NULL,
  "listingId" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "policyId" TEXT,
  "policyVersion" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CategoryOffering_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "CategoryOffering_offeringId_idx" ON "CategoryOffering"("offeringId");
CREATE INDEX "CategoryOffering_listingId_category_idx" ON "CategoryOffering"("listingId", "category");

CREATE TABLE "CategoryBookingSnapshot" (
  "id" TEXT NOT NULL,
  "bookingId" TEXT NOT NULL,
  "offeringId" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "policyId" TEXT,
  "policyVersion" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CategoryBookingSnapshot_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CategoryBookingSnapshot_bookingId_key" ON "CategoryBookingSnapshot"("bookingId");
CREATE INDEX "CategoryBookingSnapshot_offeringId_idx" ON "CategoryBookingSnapshot"("offeringId");
