-- AlterTable
ALTER TABLE "Booking" ADD COLUMN "organizationId" TEXT;

-- CreateIndex
CREATE INDEX "Booking_organizationId_idx" ON "Booking"("organizationId");
