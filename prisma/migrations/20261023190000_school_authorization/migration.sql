-- Organizations context: append-only school authorization, complaints,
-- verified listing-to-organization bindings, and non-granting bookingMode notes.
-- Additive empty tables. Safe for `prisma db push` on a populated database.

CREATE TABLE "SchoolAuthorizationEvent" (
  "id" TEXT NOT NULL,
  "listingId" TEXT NOT NULL,
  "sequence" INTEGER NOT NULL,
  "kind" TEXT NOT NULL,
  "scopes" TEXT[],
  "actorUserId" TEXT NOT NULL,
  "evidenceRef" TEXT,
  "note" TEXT,
  "decisionVersion" INTEGER NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SchoolAuthorizationEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SchoolAuthorizationEvent_idempotencyKey_key" ON "SchoolAuthorizationEvent"("idempotencyKey");
CREATE UNIQUE INDEX "SchoolAuthorizationEvent_listingId_sequence_key" ON "SchoolAuthorizationEvent"("listingId", "sequence");
CREATE INDEX "SchoolAuthorizationEvent_listingId_sequence_idx" ON "SchoolAuthorizationEvent"("listingId", "sequence");

CREATE TABLE "ListingAuthzHead" (
  "listingId" TEXT NOT NULL,
  "headSequence" INTEGER NOT NULL DEFAULT 0,
  "decisionVersion" INTEGER NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ListingAuthzHead_pkey" PRIMARY KEY ("listingId")
);

CREATE TABLE "ListingRepresentativeAuthority" (
  "id" TEXT NOT NULL,
  "listingId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "evidenceRef" TEXT NOT NULL,
  "verifiedAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ListingRepresentativeAuthority_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ListingRepresentativeAuthority_listingId_userId_key" ON "ListingRepresentativeAuthority"("listingId", "userId");
CREATE INDEX "ListingRepresentativeAuthority_listingId_idx" ON "ListingRepresentativeAuthority"("listingId");

CREATE TABLE "ListingOrgBinding" (
  "id" TEXT NOT NULL,
  "listingId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "state" TEXT NOT NULL,
  "verifiedAt" TIMESTAMP(3),
  "verifiedByUserId" TEXT,
  "evidenceRef" TEXT,
  "activeListingKey" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ListingOrgBinding_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ListingOrgBinding_activeListingKey_key" ON "ListingOrgBinding"("activeListingKey");
CREATE INDEX "ListingOrgBinding_listingId_state_idx" ON "ListingOrgBinding"("listingId", "state");
CREATE INDEX "ListingOrgBinding_organizationId_idx" ON "ListingOrgBinding"("organizationId");

CREATE TABLE "SchoolComplaint" (
  "id" TEXT NOT NULL,
  "listingId" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "evidenceRef" TEXT NOT NULL,
  "disputedScopes" TEXT[],
  "state" TEXT NOT NULL,
  "verification" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SchoolComplaint_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SchoolComplaint_listingId_idx" ON "SchoolComplaint"("listingId");

CREATE TABLE "BookingModeAuditNote" (
  "id" TEXT NOT NULL,
  "listingId" TEXT NOT NULL,
  "bookingMode" TEXT NOT NULL,
  "note" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BookingModeAuditNote_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BookingModeAuditNote_listingId_key" ON "BookingModeAuditNote"("listingId");

ALTER TABLE "SchoolAuthorizationEvent" ADD CONSTRAINT "SchoolAuthorizationEvent_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Instructor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ListingRepresentativeAuthority" ADD CONSTRAINT "ListingRepresentativeAuthority_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Instructor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ListingOrgBinding" ADD CONSTRAINT "ListingOrgBinding_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Instructor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ListingOrgBinding" ADD CONSTRAINT "ListingOrgBinding_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SchoolComplaint" ADD CONSTRAINT "SchoolComplaint_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Instructor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BookingModeAuditNote" ADD CONSTRAINT "BookingModeAuditNote_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Instructor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
