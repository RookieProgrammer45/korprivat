-- Verification context: HandledareEnrollment legal artefact.
CREATE TABLE IF NOT EXISTS "handledare_enrollment" (
    "id" TEXT NOT NULL,
    "learnerUserId" TEXT NOT NULL,
    "handledareEmail" TEXT NOT NULL,
    "handledareName" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "inviteTokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "approvedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "handledare_enrollment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "handledare_enrollment_inviteTokenHash_key"
  ON "handledare_enrollment"("inviteTokenHash");

CREATE INDEX IF NOT EXISTS "handledare_enrollment_learnerUserId_status_idx"
  ON "handledare_enrollment"("learnerUserId", "status");

CREATE INDEX IF NOT EXISTS "handledare_enrollment_expiresAt_idx"
  ON "handledare_enrollment"("expiresAt");
