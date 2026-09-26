-- AlterTable
ALTER TABLE "user_profile" ADD COLUMN     "dateOfBirthVerified" TIMESTAMP(3),
ADD COLUMN     "diditAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "diditLastDecision" TEXT,
ADD COLUMN     "diditLastReason" TEXT,
ADD COLUMN     "diditSessionId" TEXT,
ADD COLUMN     "verificationState" TEXT NOT NULL DEFAULT 'SIGNED_UP';

-- CreateTable
CREATE TABLE "verification_event" (
    "id" TEXT NOT NULL,
    "subjectType" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "actorId" TEXT,
    "fromStatus" TEXT,
    "toStatus" TEXT NOT NULL,
    "note" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "verification_event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "didit_webhook_event" (
    "id" TEXT NOT NULL,
    "diditSessionId" TEXT NOT NULL,
    "decision" TEXT NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "didit_webhook_event_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "verification_event_subjectType_subjectId_idx" ON "verification_event"("subjectType", "subjectId");

-- CreateIndex
CREATE UNIQUE INDEX "didit_webhook_event_diditSessionId_decision_key" ON "didit_webhook_event"("diditSessionId", "decision");
