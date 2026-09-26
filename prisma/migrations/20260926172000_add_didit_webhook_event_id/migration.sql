-- AlterTable
ALTER TABLE "didit_webhook_event" ADD COLUMN "eventId" TEXT,
ADD COLUMN "webhookType" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "didit_webhook_event_eventId_key" ON "didit_webhook_event"("eventId");
