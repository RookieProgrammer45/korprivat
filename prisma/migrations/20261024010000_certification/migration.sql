-- Certification context. Empty tables plus a nullable connection link.

ALTER TABLE "SchoolConnection" ADD COLUMN "partnerId" TEXT;
CREATE INDEX "SchoolConnection_partnerId_idx" ON "SchoolConnection"("partnerId");

CREATE TABLE "Partner" (
  "id" TEXT NOT NULL,
  "legalName" TEXT NOT NULL,
  "orgNumber" TEXT NOT NULL,
  "country" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'CANDIDATE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Partner_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Partner_country_orgNumber_key" ON "Partner"("country", "orgNumber");

CREATE TABLE "Certification" (
  "id" TEXT NOT NULL,
  "partnerId" TEXT NOT NULL,
  "product" TEXT NOT NULL,
  "version" TEXT NOT NULL,
  "market" TEXT NOT NULL,
  "capabilities" TEXT[],
  "milestoneEvidence" JSONB NOT NULL,
  "prodEnabled" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Certification_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Certification_partnerId_product_version_market_key" ON "Certification"("partnerId", "product", "version", "market");
CREATE INDEX "Certification_partnerId_idx" ON "Certification"("partnerId");

ALTER TABLE "SchoolConnection" ADD CONSTRAINT "SchoolConnection_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Certification" ADD CONSTRAINT "Certification_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
