import {
  leadConversionDecision,
  leadDashboardDecision,
} from '@/lib/acquisition/lead-dashboard-policy';
import { prisma } from '@/lib/db';
import { loadFoldedAuthorization } from '@/lib/orgs/school-authorization';
import {
  decideBookingCreate,
  isSchoolAuthzEnforcementOn,
} from '@/lib/orgs/school-authorization-policy';

function activeScopes(granted: string[], withdrawn: string[]): string[] {
  const denied = new Set(withdrawn);
  return granted.filter((scope) => !denied.has(scope));
}

async function representativeVerified(listingId: string, userId: string): Promise<boolean> {
  const table = (
    prisma as unknown as {
      listingRepresentativeAuthority?: {
        findUnique: (
          args: unknown,
        ) => Promise<{ verifiedAt: Date | null; evidenceRef: string | null } | null>;
      };
    }
  ).listingRepresentativeAuthority;
  if (!table) return false;
  const row = await table.findUnique({
    where: { listingId_userId: { listingId, userId } },
  });
  return Boolean(row?.verifiedAt && row.evidenceRef);
}

async function historicalInquiryCount(listingId: string): Promise<number> {
  const table = (
    prisma as unknown as {
      offeringRequest?: { count: (args: unknown) => Promise<number> };
    }
  ).offeringRequest;
  if (!table) return 0;
  return table.count({ where: { instructorId: listingId } });
}

export async function readLeadDashboard(listingId: string, userId: string) {
  const verified = await representativeVerified(listingId, userId);
  if (!verified) {
    return leadDashboardDecision({
      representativeVerified: false,
      grantedScopes: [],
      historicalInquiryCount: 0,
    });
  }
  const [count, folded] = await Promise.all([
    historicalInquiryCount(listingId),
    loadFoldedAuthorization(listingId),
  ]);
  return leadDashboardDecision({
    representativeVerified: true,
    grantedScopes: activeScopes(folded.granted, folded.withdrawn),
    historicalInquiryCount: count,
  });
}

export async function leadPanelForUser(userId: string) {
  const listings = (
    prisma as unknown as {
      instructor?: {
        findFirst: (args: unknown) => Promise<{ id: string } | null>;
      };
    }
  ).instructor;
  if (!listings) return null;
  const listing = await listings.findFirst({
    where: { userId, providerRole: 'SCHOOL' },
    select: { id: true },
  });
  if (!listing) return null;
  const decision = await readLeadDashboard(listing.id, userId);
  if (!decision.visible) return null;
  return decision;
}

export async function convertLead(input: { listingId: string; inquiryId: string; userId: string }) {
  const verified = await representativeVerified(input.listingId, input.userId);
  if (!verified) {
    const decision = leadConversionDecision({
      representativeVerified: false,
      booking: { ok: false, status: 403, code: 'not_authorized_by_school' },
    });
    return { status: decision.status, body: decision };
  }
  const requests = (
    prisma as unknown as {
      offeringRequest?: {
        findFirst: (args: unknown) => Promise<{ id: string } | null>;
      };
    }
  ).offeringRequest;
  const inquiry = requests
    ? await requests.findFirst({
        where: { id: input.inquiryId, instructorId: input.listingId },
        select: { id: true },
      })
    : null;
  if (!inquiry) return { status: 404, body: { error: { code: 'not_found' } } };
  const instructor = await (
    prisma as unknown as {
      instructor: {
        findUnique: (args: unknown) => Promise<{ bookingMode: string | null } | null>;
      };
    }
  ).instructor.findUnique({
    where: { id: input.listingId },
    select: { bookingMode: true },
  });
  const folded = await loadFoldedAuthorization(input.listingId);
  const booking = decideBookingCreate({
    bookingMode: instructor?.bookingMode,
    folded,
    enforcementOn: isSchoolAuthzEnforcementOn(),
    submittedMode: 'request',
  });
  const decision = leadConversionDecision({ representativeVerified: true, booking });
  const { status, ...body } = decision;
  return { status, body };
}
