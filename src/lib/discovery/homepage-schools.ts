// Homepage school grid: same public card shape as the directory, ranked for the
// visitor's catalogue country (Vercel geo headers) up to HOMEPAGE_SCHOOL_PREVIEW_LIMIT.
import 'server-only';
import { buildVerifiedProviderActivationWhere } from '@/lib/business/provider-activation';
import {
  hasCanonicalCategory,
  loadPublicInstructorAggregates,
  toPublicInstructor,
} from '@/lib/business/public-instructor';
import { HOMEPAGE_SCHOOL_PREVIEW_LIMIT } from '@/lib/catalog-preview';
import {
  type InstructorFilteredItem,
  InstructorList,
  LISTING_CONTACT_SELECT,
} from '@/lib/contracts/instructors';
import { prisma } from '@/lib/db';
import { lightCatalogueWhere } from '@/lib/discovery/published-prices';
import {
  homepageSchoolRegionScore,
  type VisitorCatalogueRegion,
} from '@/lib/discovery/visitor-catalogue-region';
import { loadFoldsByListing } from '@/lib/orgs/school-authorization';
import {
  isSchoolAuthzEnforcementOn,
  listingSurfaces,
} from '@/lib/orgs/school-authorization-policy';
import {
  activePolicyListingIds,
  isCancellationPolicyEnforced,
} from '@/lib/scheduling/cancellation-policy-store';
import {
  loadInstructorPaymentEligibilityByListings,
  maskSurfacesForPayment,
} from '@/lib/scheduling/listing-eligibility';

/** Scan enough rows to fill 20 after country/region ranking. */
const WINDOW = 800;

const EMPTY_FOLD = {
  granted: [],
  withdrawn: [],
  decisionVersion: 0,
  headSequence: 0,
};

export async function listHomepageSchools(
  limit = HOMEPAGE_SCHOOL_PREVIEW_LIMIT,
  region: VisitorCatalogueRegion = { countryCode: 'se', regionSlug: null },
): Promise<InstructorFilteredItem[]> {
  const raw = await prisma.instructor.findMany({
    where: {
      AND: [await buildVerifiedProviderActivationWhere(), lightCatalogueWhere()],
    },
    select: LISTING_CONTACT_SELECT,
    orderBy: [{ city: 'asc' }, { name: 'asc' }],
    take: WINDOW,
  });

  const rows = raw
    .filter((row) => hasCanonicalCategory(row))
    .map((row) => ({ row, score: homepageSchoolRegionScore(row.id, region) }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return (
        a.row.city.localeCompare(b.row.city, 'sv') || a.row.name.localeCompare(b.row.name, 'sv')
      );
    })
    .slice(0, limit)
    .map((entry) => entry.row);

  if (rows.length === 0) return [];

  const ids = rows.map((row) => row.id);
  const [aggregates, folds] = await Promise.all([
    loadPublicInstructorAggregates(rows.map((row) => ({ id: row.id, userId: row.userId }))),
    loadFoldsByListing(ids),
  ]);
  const enforcementOn = isSchoolAuthzEnforcementOn();
  const surfacesFor = (row: { id: string; bookingMode: string | null }) =>
    listingSurfaces({
      bookingMode: row.bookingMode,
      folded: folds.get(row.id) ?? EMPTY_FOLD,
      enforcementOn,
    });

  const upcoming = await prisma.availabilitySlot.findMany({
    where: {
      instructorId: { in: ids },
      bookedAt: null,
      startsAt: { gt: new Date() },
    },
    orderBy: { startsAt: 'asc' },
    select: { instructorId: true, startsAt: true },
  });
  const nextSlot = new Map<string, string>();
  for (const slot of upcoming) {
    const row = rows.find((candidate) => candidate.id === slot.instructorId);
    if (!row || !surfacesFor(row).availabilityDisplay) continue;
    if (!nextSlot.has(slot.instructorId)) {
      nextSlot.set(slot.instructorId, slot.startsAt.toISOString());
    }
  }

  const approvedListings = isCancellationPolicyEnforced()
    ? await activePolicyListingIds(ids)
    : null;
  const paymentByListing = await loadInstructorPaymentEligibilityByListings(
    rows.map((row) => ({
      id: row.id,
      userId: row.userId,
      providerRole: row.providerRole,
    })),
  );

  const items = rows.map((row) => {
    const canCollectPayment = paymentByListing.get(row.id) === true;
    const surfaces = maskSurfacesForPayment(surfacesFor(row), canCollectPayment);
    return {
      ...toPublicInstructor(
        row,
        aggregates.get(row.id) ?? {
          verificationStatus: 'unverified',
          reviewSummary: { count: 0, averageRating: null },
        },
        surfaces.availabilityDisplay ? (nextSlot.get(row.id) ?? null) : null,
      ),
      canCollectPayment,
      surfaces,
      ...(approvedListings && !approvedListings.has(row.id)
        ? { cancellationPolicyTier: null, showCancellationPolicy: false as const }
        : {}),
    };
  });

  return InstructorList.parse({ items, cities: [] }).items;
}
