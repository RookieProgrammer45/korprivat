-- Concierge listing drafts. Provenance is required. School approval is stored
-- separately from policy, verification, and authorization. Instructor columns
-- are unchanged.

CREATE TABLE "ConciergeDraft" (
  "id" TEXT NOT NULL,
  "listingId" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "provenance" JSONB NOT NULL,
  "payload" JSONB NOT NULL,
  "state" TEXT NOT NULL DEFAULT 'DRAFT',
  "approvedAt" TIMESTAMP(3),
  "approvedByUserId" TEXT,
  "publishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ConciergeDraft_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ConciergeDraft_listingId_idx" ON "ConciergeDraft"("listingId");
ALTER TABLE "ConciergeDraft" ADD CONSTRAINT "ConciergeDraft_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Instructor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
