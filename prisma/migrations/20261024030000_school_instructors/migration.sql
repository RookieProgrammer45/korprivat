-- School-mediated instructor invitations. Empty tables. No scope grants.

CREATE TABLE "SchoolInstructorInvitation" (
  "id" TEXT NOT NULL,
  "schoolListingId" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "teachingCategories" TEXT[],
  "inventoryDelegated" BOOLEAN NOT NULL DEFAULT false,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "invitedByUserId" TEXT NOT NULL,
  "acceptedByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SchoolInstructorInvitation_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "SchoolInstructorInvitation_schoolListingId_idx" ON "SchoolInstructorInvitation"("schoolListingId");
CREATE INDEX "SchoolInstructorInvitation_email_idx" ON "SchoolInstructorInvitation"("email");

CREATE TABLE "SchoolInstructorAffiliation" (
  "id" TEXT NOT NULL,
  "invitationId" TEXT NOT NULL,
  "schoolListingId" TEXT NOT NULL,
  "instructorUserId" TEXT NOT NULL,
  "instructorListingId" TEXT,
  "teachingCategories" TEXT[],
  "inventoryDelegated" BOOLEAN NOT NULL DEFAULT false,
  "status" TEXT NOT NULL DEFAULT 'VERIFIED',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SchoolInstructorAffiliation_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SchoolInstructorAffiliation_invitationId_key" ON "SchoolInstructorAffiliation"("invitationId");
CREATE INDEX "SchoolInstructorAffiliation_schoolListingId_idx" ON "SchoolInstructorAffiliation"("schoolListingId");
CREATE INDEX "SchoolInstructorAffiliation_instructorUserId_idx" ON "SchoolInstructorAffiliation"("instructorUserId");
CREATE INDEX "SchoolInstructorAffiliation_instructorListingId_idx" ON "SchoolInstructorAffiliation"("instructorListingId");

ALTER TABLE "SchoolInstructorInvitation" ADD CONSTRAINT "SchoolInstructorInvitation_schoolListingId_fkey" FOREIGN KEY ("schoolListingId") REFERENCES "Instructor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SchoolInstructorAffiliation" ADD CONSTRAINT "SchoolInstructorAffiliation_invitationId_fkey" FOREIGN KEY ("invitationId") REFERENCES "SchoolInstructorInvitation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SchoolInstructorAffiliation" ADD CONSTRAINT "SchoolInstructorAffiliation_schoolListingId_fkey" FOREIGN KEY ("schoolListingId") REFERENCES "Instructor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
