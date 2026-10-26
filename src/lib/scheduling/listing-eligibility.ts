import 'server-only';
import { prisma } from '@/lib/db';
import { loadListingBindings } from '@/lib/orgs/school-authorization';
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
    loadInstructorAffiliation(input),
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
  providerRole: string | null | undefined;
}): Promise<boolean> {
  if (input.providerRole === 'SCHOOL') return true;
  const bindings = await loadListingBindings([input.listingId]);
  const active = bindings.filter((row) => row.state === 'ACTIVE' && row.verifiedAt);
  return active.length === 1;
}
