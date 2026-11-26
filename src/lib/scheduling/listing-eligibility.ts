import 'server-only';
import { instructorPaymentDecision } from '@/lib/acquisition/mediated-instructor-policy';
import { verifiedAffiliationForUser } from '@/lib/acquisition/mediated-instructor-store';
import { prisma } from '@/lib/db';
import { loadListingBindings } from '@/lib/orgs/school-authorization';
import type { SurfacePermissions } from '@/lib/orgs/school-authorization-policy';
import { withDirectoryFlag } from '@/lib/orgs/school-authorization-policy';
import type { PolicyFacts } from '@/lib/scheduling/booking-policy';

type LicenseStatus = NonNullable<PolicyFacts['licenceStatus']>;

function asLicenceStatus(value: string | null | undefined): LicenseStatus | null {
  if (value === 'VERIFIED' || value === 'EXPIRED' || value === 'PENDING' || value === 'REVOKED') {
    return value;
  }
  if (value === 'REJECTED') return 'REVOKED';
  return null;
}

export async function loadListingEligibilityFacts(input: {
  listingId: string;
  userId: string | null | undefined;
  category: string;
  listingCategories: string[];
  providerRole: string | null | undefined;
}): Promise<{
  categoryAllowed: boolean;
  licenceStatus: LicenseStatus | null;
  instructorAffiliated: boolean;
}> {
  const categoryAllowed = input.listingCategories.includes(input.category);
  const [licenceStatus, instructorAffiliated] = await Promise.all([
    loadLicenceStatus(input),
    loadInstructorAffiliation({
      listingId: input.listingId,
      userId: input.userId,
      providerRole: input.providerRole,
    }),
  ]);
  return { categoryAllowed, licenceStatus, instructorAffiliated };
}

async function loadLicenceStatus(input: {
  listingId: string;
  userId: string | null | undefined;
  category: string;
}): Promise<LicenseStatus | null> {
  const client = prisma as unknown as {
    instructorLicense?: {
      findUnique: (args: unknown) => Promise<{ status: string } | null>;
    };
    teachingPermission?: {
      findFirst: (args: unknown) => Promise<{ status: string } | null>;
    };
  };
  if (input.userId && client.instructorLicense) {
    const license = await client.instructorLicense.findUnique({
      where: { userId: input.userId },
      select: { status: true },
    });
    const status = asLicenceStatus(license?.status);
    if (status) return status;
  }
  if (client.teachingPermission) {
    const permission = await client.teachingPermission.findFirst({
      where: { listingId: input.listingId, category: input.category, status: 'CURRENT' },
      select: { status: true },
    });
    if (permission?.status === 'CURRENT') return 'VERIFIED';
  }
  return null;
}

async function loadInstructorAffiliation(input: {
  listingId: string;
  userId?: string | null | undefined;
  providerRole: string | null | undefined;
}): Promise<boolean> {
  if (input.providerRole === 'SCHOOL') return true;
  if (input.userId) {
    const affiliation = await verifiedAffiliationForUser(input.userId);
    if (affiliation) return true;
  }
  const bindings = await loadListingBindings([input.listingId]);
  const active = bindings.filter((row) => row.state === 'ACTIVE' && row.verifiedAt);
  return active.length === 1;
}

export async function loadInstructorPaymentEligibility(input: {
  listingId: string;
  userId: string | null | undefined;
  providerRole: string | null | undefined;
}): Promise<{ allowed: boolean; code: string }> {
  const affiliationVerified = await loadInstructorAffiliation(input);
  return instructorPaymentDecision({
    providerRole: input.providerRole,
    affiliationVerified,
  });
}

export function maskSurfacesForPayment(
  surfaces: SurfacePermissions,
  canCollectPayment: boolean,
): SurfacePermissions {
  if (canCollectPayment) return surfaces;
  return withDirectoryFlag({
    ...surfaces,
    requestToBook: false,
    transactionalBooking: false,
  });
}

export async function loadInstructorPaymentEligibilityByListings(
  rows: Array<{
    id: string;
    userId: string | null | undefined;
    providerRole: string | null | undefined;
  }>,
): Promise<Map<string, boolean>> {
  const result = new Map<string, boolean>();
  const pending: typeof rows = [];
  for (const row of rows) {
    if (row.providerRole === 'SCHOOL') {
      result.set(row.id, true);
    } else if (row.providerRole === 'HANDLEDARE') {
      result.set(row.id, false);
    } else {
      pending.push(row);
    }
  }
  if (pending.length === 0) return result;

  const userIds = pending.flatMap((row) => (row.userId ? [row.userId] : []));
  const client = prisma as unknown as {
    schoolInstructorAffiliation?: {
      findMany: (args: unknown) => Promise<Array<{ instructorUserId: string }>>;
    };
  };
  const affiliations =
    userIds.length > 0 && client.schoolInstructorAffiliation
      ? await client.schoolInstructorAffiliation.findMany({
          where: { instructorUserId: { in: userIds }, status: 'VERIFIED' },
          select: { instructorUserId: true },
        })
      : [];
  const affiliatedUsers = new Set(affiliations.map((row) => row.instructorUserId));
  const bindings = await loadListingBindings(pending.map((row) => row.id));
  const boundListings = new Set<string>();
  const byListing = new Map<string, number>();
  for (const row of bindings) {
    if (row.state !== 'ACTIVE' || !row.verifiedAt) continue;
    byListing.set(row.listingId, (byListing.get(row.listingId) ?? 0) + 1);
  }
  for (const [listingId, count] of byListing) {
    if (count === 1) boundListings.add(listingId);
  }
  for (const row of pending) {
    const viaAffiliation = Boolean(row.userId && affiliatedUsers.has(row.userId));
    result.set(row.id, viaAffiliation || boundListings.has(row.id));
  }
  return result;
}
