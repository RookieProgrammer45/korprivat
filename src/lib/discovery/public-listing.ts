// Server-side public listing reads for school profiles and city hubs.
// Anonymous visitors get the same card/profile payload as a signed-in session;
// GET /api/instructors/[id] stays auth-gated.
import 'server-only';
import { cache } from 'react';
import { buildVerifiedProviderActivationWhere } from '@/lib/business/provider-activation';
import {
  hasCanonicalCategory,
  loadPublicInstructorAggregates,
  toPublicInstructor,
} from '@/lib/business/public-instructor';
import {
  type InstructorFilteredItem,
  InstructorItem,
  InstructorList,
  LISTING_CONTACT_SELECT,
} from '@/lib/contracts/instructors';
import { prisma } from '@/lib/db';
import { nordicInstructorById } from '@/lib/discovery/nordic-catalogue';
import { lightCatalogueWhere } from '@/lib/discovery/published-prices';
import { getActiveAffiliationForUser } from '@/lib/orgs/public';
import { loadFoldsByListing, loadListingSurfaces } from '@/lib/orgs/school-authorization';
import {
  type FoldedAuthorization,
  isSchoolAuthzEnforcementOn,
  listingSurfaces,
} from '@/lib/orgs/school-authorization-policy';
import {
  activePolicyListingIds,
  isCancellationPolicyEnforced,
  listingHasActiveCancellationPolicy,
} from '@/lib/scheduling/cancellation-policy-store';
import {
  loadInstructorPaymentEligibility,
  loadInstructorPaymentEligibilityByListings,
  maskSurfacesForPayment,
} from '@/lib/scheduling/listing-eligibility';
import { schoolsForLocation } from '@/lib/seo/catalogue-locations';
import { cityFilterCandidates, type NordicLocation } from '@/lib/seo/nordic-locations';

const EMPTY_FOLD: FoldedAuthorization = {
  granted: [],
  withdrawn: [],
  decisionVersion: 0,
  headSequence: 0,
};

const CITY_LISTING_LIMIT = 80;

export type CityListingStatSource = {
  publishedPrices?: {
    lesson?: { priceSek: number; minutes: number | null } | null;
    collectedAt?: string;
  } | null;
};

export type CityListingStats = {
  count: number;
  minLessonSek: number | null;
  medianLessonSek: number | null;
  typicalMinutes: number | null;
  latestCollectedAt: string | null;
};

type ListingContactRow = {
  id: string;
  userId: string | null;
  bookingMode: string | null;
  providerRole: string | null;
};

export function omitListingReviewBodies<T extends { googleReviews?: unknown }>(item: T): T {
  if (!('googleReviews' in item) || item.googleReviews == null) return item;
  const { googleReviews: _ignored, ...rest } = item;
  return rest as T;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid] ?? null;
  const left = sorted[mid - 1];
  const right = sorted[mid];
  if (left == null || right == null) return null;
  return Math.round((left + right) / 2);
}

export function cityListingStats(schools: CityListingStatSource[]): CityListingStats {
  const prices = schools.flatMap((school) => {
    const price = school.publishedPrices?.lesson?.priceSek;
    return typeof price === 'number' ? [price] : [];
  });
  const minutes = schools.flatMap((school) => {
    const value = school.publishedPrices?.lesson?.minutes;
    return typeof value === 'number' ? [value] : [];
  });
  const dates = schools.flatMap((school) => {
    const value = school.publishedPrices?.collectedAt;
    return value ? [value] : [];
  });
  return {
    count: schools.length,
    minLessonSek: prices.length > 0 ? Math.min(...prices) : null,
    medianLessonSek: median(prices),
    typicalMinutes: median(minutes),
    latestCollectedAt: dates.sort().at(-1) ?? null,
  };
}

export async function assemblePublicDirectoryItems(
  rows: Array<Parameters<typeof toPublicInstructor>[0] & ListingContactRow>,
  options?: { includeReviewBodies?: boolean; distances?: Map<string, number> },
): Promise<InstructorFilteredItem[]> {
  if (rows.length === 0) return [];

  const includeReviewBodies = options?.includeReviewBodies === true;
  const ids = rows.map((row) => row.id);
  const [aggregates, folds] = await Promise.all([
    loadPublicInstructorAggregates(
      rows.map((row) => ({ id: row.id, userId: row.userId })),
      { includeGoogleReviewBodies: includeReviewBodies },
    ),
    loadFoldsByListing(ids),
  ]);
  const enforcementOn = isSchoolAuthzEnforcementOn();
  const surfacesFor = (row: ListingContactRow) =>
    listingSurfaces({
      bookingMode: row.bookingMode,
      folded: folds.get(row.id) ?? EMPTY_FOLD,
      enforcementOn,
    });

  const upcoming = prisma.availabilitySlot
    ? await prisma.availabilitySlot.findMany({
        where: {
          instructorId: { in: ids },
          bookedAt: null,
          startsAt: { gt: new Date() },
        },
        orderBy: { startsAt: 'asc' },
        select: { instructorId: true, startsAt: true },
      })
    : [];
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
    const projected = {
      ...toPublicInstructor(
        row,
        aggregates.get(row.id) ?? {
          verificationStatus: 'unverified' as const,
          reviewSummary: { count: 0, averageRating: null },
        },
        surfaces.availabilityDisplay ? (nextSlot.get(row.id) ?? null) : null,
        options?.distances?.get(row.id),
      ),
      canCollectPayment,
      surfaces,
      ...(approvedListings && !approvedListings.has(row.id)
        ? { cancellationPolicyTier: null, showCancellationPolicy: false as const }
        : {}),
    };
    return includeReviewBodies ? projected : omitListingReviewBodies(projected);
  });

  return InstructorList.parse({ items, cities: [] }).items;
}

export async function loadPublicListingById(id: string): Promise<InstructorFilteredItem | null> {
  const nordic = nordicInstructorById(id);
  if (nordic) return InstructorItem.parse(nordic);

  const instructor = await prisma.instructor.findUnique({
    where: { id },
    select: LISTING_CONTACT_SELECT,
  });
  if (!instructor || !hasCanonicalCategory(instructor)) return null;

  const [aggregates, affiliation] = await Promise.all([
    loadPublicInstructorAggregates([{ id: instructor.id, userId: instructor.userId }], {
      includeGoogleReviewBodies: true,
    }),
    getActiveAffiliationForUser(instructor.userId),
  ]);
  const slot = prisma.availabilitySlot
    ? await prisma.availabilitySlot.findFirst({
        where: {
          instructorId: instructor.id,
          bookedAt: null,
          startsAt: { gt: new Date() },
        },
        orderBy: { startsAt: 'asc' },
        select: { startsAt: true },
      })
    : null;
  const aggregate = aggregates.get(instructor.id) ?? {
    verificationStatus: 'unverified' as const,
    reviewSummary: { count: 0, averageRating: null },
  };
  const payment = await loadInstructorPaymentEligibility({
    listingId: instructor.id,
    userId: instructor.userId,
    providerRole: instructor.providerRole,
  });
  const surfaces = maskSurfacesForPayment(
    await loadListingSurfaces(instructor.id, instructor.bookingMode),
    payment.allowed,
  );
  const nextSlotAt = surfaces.availabilityDisplay ? (slot?.startsAt.toISOString() ?? null) : null;
  const hidePolicy =
    isCancellationPolicyEnforced() && !(await listingHasActiveCancellationPolicy(instructor.id));

  return InstructorItem.parse({
    ...toPublicInstructor(instructor, aggregate, nextSlotAt),
    affiliation: affiliation ? { name: affiliation.name, slug: affiliation.slug } : null,
    canCollectPayment: payment.allowed,
    surfaces,
    ...(hidePolicy ? { cancellationPolicyTier: null, showCancellationPolicy: false } : {}),
  });
}

async function listPublicSchoolsForCityUncached(
  city: string,
  limit = CITY_LISTING_LIMIT,
): Promise<InstructorFilteredItem[]> {
  const names = cityFilterCandidates(city);
  if (names.length === 0) return [];

  const raw = await prisma.instructor.findMany({
    where: {
      AND: [
        await buildVerifiedProviderActivationWhere(),
        lightCatalogueWhere(),
        {
          OR: names.map((name) => ({
            city: { equals: name, mode: 'insensitive' as const },
          })),
        },
      ],
    },
    select: LISTING_CONTACT_SELECT,
    orderBy: [{ name: 'asc' }],
    take: limit,
  });

  const rows = raw.filter((row) => hasCanonicalCategory(row));
  return assemblePublicDirectoryItems(rows, { includeReviewBodies: false });
}

export const listPublicSchoolsForCity = cache(listPublicSchoolsForCityUncached);

export const publicSchoolsForLocation = cache(
  async (location: NordicLocation): Promise<InstructorFilteredItem[]> => {
    if (location.kind !== 'city') return [];
    if (location.country === 'se') {
      return listPublicSchoolsForCity(location.filterCity ?? location.name);
    }
    return schoolsForLocation(location);
  },
);
