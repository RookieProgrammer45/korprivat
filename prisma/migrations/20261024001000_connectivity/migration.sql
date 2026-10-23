-- Connectivity context. Empty tables. No production enablement.

CREATE TABLE "PartnerCredential" (
  "id" TEXT NOT NULL,
  "partnerKey" TEXT NOT NULL,
  "environment" TEXT NOT NULL,
  "schoolConnectionId" TEXT NOT NULL,
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PartnerCredential_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "PartnerCredential_partnerKey_environment_idx" ON "PartnerCredential"("partnerKey", "environment");
CREATE INDEX "PartnerCredential_schoolConnectionId_idx" ON "PartnerCredential"("schoolConnectionId");

CREATE TABLE "ConnectivityIdempotency" (
  "id" TEXT NOT NULL,
  "schoolConnectionId" TEXT NOT NULL,
  "operationType" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "payloadHash" TEXT NOT NULL,
  "responseStatus" INTEGER NOT NULL,
  "responseBody" JSONB NOT NULL,
  "correlationId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ConnectivityIdempotency_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ConnectivityIdempotency_schoolConnectionId_operationType_idempotencyKey_key" ON "ConnectivityIdempotency"("schoolConnectionId", "operationType", "idempotencyKey");
CREATE INDEX "ConnectivityIdempotency_schoolConnectionId_idx" ON "ConnectivityIdempotency"("schoolConnectionId");

CREATE TABLE "ConnectionContentDraft" (
  "id" TEXT NOT NULL,
  "schoolConnectionId" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "payloadHash" TEXT NOT NULL,
  "publishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ConnectionContentDraft_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ConnectionContentDraft_schoolConnectionId_idx" ON "ConnectionContentDraft"("schoolConnectionId");

CREATE TABLE "ConnectionReadiness" (
  "id" TEXT NOT NULL,
  "schoolConnectionId" TEXT NOT NULL,
  "evidenceSource" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ConnectionReadiness_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ConnectionReadiness_schoolConnectionId_key" ON "ConnectionReadiness"("schoolConnectionId");

ALTER TABLE "PartnerCredential" ADD CONSTRAINT "PartnerCredential_schoolConnectionId_fkey" FOREIGN KEY ("schoolConnectionId") REFERENCES "SchoolConnection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ConnectivityIdempotency" ADD CONSTRAINT "ConnectivityIdempotency_schoolConnectionId_fkey" FOREIGN KEY ("schoolConnectionId") REFERENCES "SchoolConnection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ConnectionContentDraft" ADD CONSTRAINT "ConnectionContentDraft_schoolConnectionId_fkey" FOREIGN KEY ("schoolConnectionId") REFERENCES "SchoolConnection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ConnectionReadiness" ADD CONSTRAINT "ConnectionReadiness_schoolConnectionId_fkey" FOREIGN KEY ("schoolConnectionId") REFERENCES "SchoolConnection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
