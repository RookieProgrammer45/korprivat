// The three schools on the homepage. Same public card as
// GET /api/instructors?limit=3, but the query stops after a small window
// instead of loading every Swedish listing and then slicing.
import 'server-only';
import { buildVerifiedProviderActivationWhere } from '@/lib/business/provider-activation';
import {
  hasCanonicalCategory,
  loadPublicInstructorAggregates,
  toPublicInstructor,
} from '@/lib/business/public-instructor';
import { PUBLIC_CATALOG_PREVIEW_LIMIT } from '@/lib/catalog-preview';
import {
  type InstructorFilteredItem,
  InstructorList,
  LISTING_CONTACT_SELECT,
} from '@/lib/contracts/instructors';
import { prisma } from '@/lib/db';
import { lightCatalogueWhere } from '@/lib/discovery/published-prices';
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

const WINDOW = PUBLIC_CATALOG_PREVIEW_LIMIT * 8;

const EMPTY_FOLD = {
  granted: [],
  withdrawn: [],
  decisionVersion: 0,
  headSequence: 0,
};

export async function listHomepageSchools(
  limit = PUBLIC_CATALOG_PREVIEW_LIMIT,
): Promise<InstructorFilteredItem[]> {
  const raw = await prisma.instructor.findMany({
    where: {
      AND: [await buildVerifiedProviderActivationWhere(), lightCatalogueWhere()],
    },
    select: LISTING_CONTACT_SELECT,
    orderBy: [{ city: 'asc' }, { name: 'asc' }],
    take: WINDOW,
  });
  const rows = raw.filter((row) => hasCanonicalCategory(row)).slice(0, limit);
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
