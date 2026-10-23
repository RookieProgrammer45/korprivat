-- Acquisition context. Empty tables. No instructor or authorization writes.

CREATE TABLE "ListingProspect" (
  "id" TEXT NOT NULL,
  "legalName" TEXT NOT NULL,
  "orgNumber" TEXT NOT NULL,
  "country" TEXT NOT NULL,
  "city" TEXT NOT NULL,
  "categories" TEXT[],
  "source" TEXT NOT NULL,
  "eligibility" TEXT NOT NULL DEFAULT 'PENDING',
  "dataQuality" TEXT NOT NULL DEFAULT 'PENDING',
  "visibility" TEXT NOT NULL DEFAULT 'PRIVATE',
  "claimState" TEXT NOT NULL DEFAULT 'UNCLAIMED',
  "policyDraft" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ListingProspect_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ListingProspect_country_orgNumber_key" ON "ListingProspect"("country", "orgNumber");
CREATE INDEX "ListingProspect_visibility_idx" ON "ListingProspect"("visibility");

CREATE TABLE "ProspectClaim" (
  "id" TEXT NOT NULL,
  "prospectId" TEXT NOT NULL,
  "claimantUserId" TEXT NOT NULL,
  "identityEvidenceRef" TEXT NOT NULL,
  "mandateEvidenceRef" TEXT NOT NULL,
  "identityStatus" TEXT NOT NULL DEFAULT 'PENDING_REVIEW',
  "mandateStatus" TEXT NOT NULL DEFAULT 'PENDING_REVIEW',
  "representativeStatus" TEXT NOT NULL DEFAULT 'PENDING_REVIEW',
  "scopesGranted" TEXT[],
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProspectClaim_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ProspectClaim_prospectId_idx" ON "ProspectClaim"("prospectId");

ALTER TABLE "ProspectClaim" ADD CONSTRAINT "ProspectClaim_prospectId_fkey" FOREIGN KEY ("prospectId") REFERENCES "ListingProspect"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
