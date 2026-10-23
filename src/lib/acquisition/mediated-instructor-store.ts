import {
  independentPublicationDecision,
  invitationCategoryDecision,
  isSchoolMediatedInstructorsOn,
} from '@/lib/acquisition/mediated-instructor-policy';
import { prisma } from '@/lib/db';

type AffiliationRow = {
  id: string;
  teachingCategories: string[];
  inventoryDelegated: boolean;
  status: string;
};

function tables() {
  return prisma as unknown as {
    instructor?: {
      findUnique: (args: unknown) => Promise<{
        id: string;
        providerRole: string | null;
        categories: string[];
      } | null>;
    };
    listingRepresentativeAuthority?: {
      findUnique: (
        args: unknown,
      ) => Promise<{ userId: string; verifiedAt: Date; evidenceRef: string } | null>;
    };
    schoolInstructorInvitation?: {
      create: (args: unknown) => Promise<{ id: string }>;
      findUnique: (args: unknown) => Promise<{
        id: string;
        email: string;
        status: string;
        schoolListingId: string;
        teachingCategories: string[];
        inventoryDelegated: boolean;
      } | null>;
      update: (args: unknown) => Promise<{ id: string }>;
    };
    schoolInstructorAffiliation?: {
      findFirst: (args: unknown) => Promise<AffiliationRow | null>;
      create: (args: unknown) => Promise<{ id: string }>;
      update: (args: unknown) => Promise<{ id: string }>;
    };
    schoolAuthorizationEvent?: { create: (args: unknown) => Promise<unknown> };
  };
}

export async function verifiedAffiliationForUser(userId: string): Promise<AffiliationRow | null> {
  const table = tables().schoolInstructorAffiliation;
  if (!table) return null;
  return table.findFirst({ where: { instructorUserId: userId, status: 'VERIFIED' } });
}

export async function independentInstructorBlock(
  userId: string,
  requestedRole: string,
): Promise<
  { status: 403; code: string } | { status: 200; affiliation: AffiliationRow | null } | null
> {
  if (!isSchoolMediatedInstructorsOn() || requestedRole !== 'INSTRUCTOR') return null;
  const affiliation = await verifiedAffiliationForUser(userId);
  const decision = independentPublicationDecision({
    enforced: true,
    providerRole: 'INSTRUCTOR',
    affiliationVerified: affiliation != null,
  });
  if (!decision.allowed) return { status: 403, code: decision.code };
  return { status: 200, affiliation };
}

export async function stampInstructorListing(affiliationId: string, instructorListingId: string) {
  const table = tables().schoolInstructorAffiliation;
  if (!table) return;
  await table.update({ where: { id: affiliationId }, data: { instructorListingId } });
}

export async function inviteSchoolInstructor(input: {
  schoolListingId: string;
  actorUserId: string;
  email: string;
  teachingCategories: string[];
  inventoryDelegated: boolean;
}): Promise<{ status: number; body: Record<string, unknown> }> {
  const db = tables();
  if (!db.instructor || !db.listingRepresentativeAuthority || !db.schoolInstructorInvitation) {
    return { status: 503, body: { error: { code: 'not_available' } } };
  }
  const school = await db.instructor.findUnique({
    where: { id: input.schoolListingId },
    select: { id: true, providerRole: true, categories: true },
  });
  if (!school || school.providerRole !== 'SCHOOL') {
    return { status: 403, body: { error: { code: 'school_listing_required' } } };
  }
  const representative = await db.listingRepresentativeAuthority.findUnique({
    where: { listingId_userId: { listingId: input.schoolListingId, userId: input.actorUserId } },
  });
  if (!representative?.verifiedAt || !representative.evidenceRef) {
    return { status: 403, body: { error: { code: 'not_representative' } } };
  }
  const categories = invitationCategoryDecision(school.categories, input.teachingCategories);
  if (!categories.allowed) return { status: 403, body: { error: { code: categories.code } } };
  const row = await db.schoolInstructorInvitation.create({
    data: {
      schoolListingId: input.schoolListingId,
      email: input.email.toLowerCase(),
      teachingCategories: input.teachingCategories,
      inventoryDelegated: input.inventoryDelegated,
      status: 'PENDING',
      invitedByUserId: input.actorUserId,
    },
  });
  return {
    status: 201,
    body: {
      id: row.id,
      status: 'PENDING',
      scopesGranted: [],
      inventoryDelegated: input.inventoryDelegated,
    },
  };
}

export async function acceptSchoolInstructorInvitation(input: {
  invitationId: string;
  userId: string;
  email: string;
}): Promise<{ status: number; body: Record<string, unknown> }> {
  const db = tables();
  if (!db.schoolInstructorInvitation || !db.schoolInstructorAffiliation) {
    return { status: 503, body: { error: { code: 'not_available' } } };
  }
  const invitation = await db.schoolInstructorInvitation.findUnique({
    where: { id: input.invitationId },
  });
  if (!invitation || invitation.status !== 'PENDING') {
    return { status: 404, body: { error: { code: 'not_found' } } };
  }
  if (invitation.email !== input.email.trim().toLowerCase()) {
    return { status: 403, body: { error: { code: 'invitee_mismatch' } } };
  }
  const affiliation = await db.schoolInstructorAffiliation.create({
    data: {
      invitationId: invitation.id,
      schoolListingId: invitation.schoolListingId,
      instructorUserId: input.userId,
      teachingCategories: invitation.teachingCategories,
      inventoryDelegated: invitation.inventoryDelegated,
      status: 'VERIFIED',
    },
  });
  await db.schoolInstructorInvitation.update({
    where: { id: invitation.id },
    data: { status: 'VERIFIED', acceptedByUserId: input.userId },
  });
  return {
    status: 200,
    body: {
      affiliationId: affiliation.id,
      schoolListingId: invitation.schoolListingId,
      teachingCategories: invitation.teachingCategories,
      inventoryDelegated: invitation.inventoryDelegated,
      scopesGranted: [],
      authorizationEventsCreated: 0,
    },
  };
}
