-- Risk 1 / Risk 2 dated group sessions. Additive only.

CREATE TABLE "RiskCourseSession" (
  "id" TEXT NOT NULL,
  "listingId" TEXT NOT NULL,
  "courseType" TEXT NOT NULL,
  "licenceCategory" TEXT NOT NULL,
  "municipality" TEXT NOT NULL,
  "location" TEXT NOT NULL,
  "startsAt" TIMESTAMP(3) NOT NULL,
  "endsAt" TIMESTAMP(3) NOT NULL,
  "seatCapacity" INTEGER NOT NULL,
  "priceSek" INTEGER NOT NULL,
  "publishedAt" TIMESTAMP(3),
  "approvedAt" TIMESTAMP(3),
  "approvedByUserId" TEXT,
  "source" TEXT NOT NULL DEFAULT 'SCHOOL_PUBLISHED',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RiskCourseSession_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "RiskCourseSession_listingId_idx" ON "RiskCourseSession"("listingId");
CREATE INDEX "RiskCourseSession_courseType_municipality_startsAt_idx" ON "RiskCourseSession"("courseType", "municipality", "startsAt");
ALTER TABLE "RiskCourseSession" ADD CONSTRAINT "RiskCourseSession_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Instructor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "RiskCourseRequest" (
  "id" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "listingId" TEXT NOT NULL,
  "studentUserId" TEXT,
  "studentName" TEXT NOT NULL,
  "studentEmail" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "commitmentRoute" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RiskCourseRequest_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "RiskCourseRequest_sessionId_idx" ON "RiskCourseRequest"("sessionId");
CREATE INDEX "RiskCourseRequest_listingId_idx" ON "RiskCourseRequest"("listingId");
ALTER TABLE "RiskCourseRequest" ADD CONSTRAINT "RiskCourseRequest_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "RiskCourseSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
