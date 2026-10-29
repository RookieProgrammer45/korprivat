import 'server-only';
import { withUsualMotorcycleCategories } from '@/lib/business/licence-categories';
import { isProviderActivated } from '@/lib/business/provider-activation';
import { prisma } from '@/lib/db';
import {
  hasWebsitePrice,
  publishedInbox,
  publishedPhone,
  publishedPrices,
} from '@/lib/discovery/published-prices';
import {
  phoneFact,
  resolvePriceRequest,
  resolveSchoolContact,
} from '@/lib/discovery/school-contact';
import { publishedBookingMode } from '@/lib/scheduling/booking-creation';

export type PublicGoogleReview = {
  id: string;
  authorName: string;
  rating: number;
  comment: string;
  relativeTime: string | null;
};

export type PublicInstructorAggregate = {
  verificationStatus: 'verified' | 'pending' | 'rejected' | 'unverified';
  reviewSummary: { count: number; averageRating: number | null };
  googleReviews?: PublicGoogleReview[];
};

const MAX_PUBLIC_GOOGLE_REVIEWS = 5;

type PublicInstructorSource = {
  id: string;
  userId: string | null;
  name: string;
  city: string;
  serviceArea: string | null;
  categories: string[];
  hourlyRateSek: number;
  bio: string;
  photoUrl: string;
  englishSpeaking: boolean;
  cancellationPolicyTier: string | null;
  bookingMode: string | null;
  providerRole?: string | null;
  // Google Places snapshot columns — optional so every existing caller of
  // this helper keeps compiling; toPublicInstructor null-fills them.
  googleRating?: number | null;
  googleReviewCount?: number | null;
  googleMapsUri?: string | null;
  email?: string | null;
};

type ReviewRow = { instructorId: string; rating: number };
type LicenseRow = { userId: string; status: string };
type GoogleReviewRow = {
  id: string;
  instructorId: string;
  authorName: string;
  rating: number;
  comment: string;
  relativeTime: string | null;
};

export async function loadPublicInstructorAggregates(
  rows: Array<Pick<PublicInstructorSource, 'id' | 'userId'>>,
): Promise<Map<string, PublicInstructorAggregate>> {
  const result = new Map<string, PublicInstructorAggregate>();
  const instructorIds = rows.map((row) => row.id);
  const userIds = rows.flatMap((row) => (row.userId ? [row.userId] : []));

  const [licenses, reviews, googleReviews] = await Promise.all([
    userIds.length > 0 && prisma.instructorLicense
      ? prisma.instructorLicense.findMany({
          where: { userId: { in: userIds } },
          select: { userId: true, status: true },
        })
      : Promise.resolve([] as LicenseRow[]),
    instructorIds.length > 0 && prisma.review
      ? prisma.review.findMany({
          where: { instructorId: { in: instructorIds } },
          select: { instructorId: true, rating: true },
        })
      : Promise.resolve([] as ReviewRow[]),
    instructorIds.length > 0 && prisma.googleReview
      ? prisma.googleReview.findMany({
          where: { instructorId: { in: instructorIds } },
          select: {
            id: true,
            instructorId: true,
            authorName: true,
            rating: true,
            comment: true,
            relativeTime: true,
            publishTime: true,
          },
          orderBy: { publishTime: 'desc' },
        })
      : Promise.resolve([] as GoogleReviewRow[]),
  ]);

  const statusByUser = new Map<string, PublicInstructorAggregate['verificationStatus']>();
  for (const license of licenses) {
    const status = license.status.toUpperCase();
    statusByUser.set(
      license.userId,
      status === 'VERIFIED'
        ? 'verified'
        : status === 'PENDING'
          ? 'pending'
          : status === 'REJECTED'
            ? 'rejected'
            : 'unverified',
    );
  }

  const reviewsByInstructor = new Map<string, number[]>();
  for (const review of reviews) {
    if (!Number.isInteger(review.rating) || review.rating < 1 || review.rating > 5) {
      continue;
    }

    const existing = reviewsByInstructor.get(review.instructorId) ?? [];
    existing.push(review.rating);
    reviewsByInstructor.set(review.instructorId, existing);
  }

  const googleByInstructor = new Map<string, PublicGoogleReview[]>();
  for (const review of googleReviews) {
    if (!Number.isInteger(review.rating) || review.rating < 1 || review.rating > 5) {
      continue;
    }
    const existing = googleByInstructor.get(review.instructorId) ?? [];
    if (existing.length >= MAX_PUBLIC_GOOGLE_REVIEWS) continue;
    existing.push({
      id: review.id,
      authorName: review.authorName,
      rating: review.rating,
      comment: review.comment,
      relativeTime: review.relativeTime,
    });
    googleByInstructor.set(review.instructorId, existing);
  }

  for (const row of rows) {
    const ratings = reviewsByInstructor.get(row.id) ?? [];
    const average =
      ratings.length > 0
        ? Math.round((ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length) * 10) / 10
        : null;
    result.set(row.id, {
      verificationStatus: row.userId
        ? (statusByUser.get(row.userId) ?? 'unverified')
        : 'unverified',
      reviewSummary: { count: ratings.length, averageRating: average },
      googleReviews: googleByInstructor.get(row.id) ?? [],
    });
  }

  return result;
}

export function toPublicInstructor(
  row: PublicInstructorSource,
  aggregate: PublicInstructorAggregate,
  nextSlotAt: string | null,
  distanceKm?: number,
) {
  const categories = withUsualMotorcycleCategories(row.categories).filter((category) =>
    isProviderActivated([category]),
  );
  const prices = publishedPrices(row.id);
  const contactInput = {
    providerRole: row.providerRole,
    email: row.email,
    bio: row.bio,
    inbox: publishedInbox(row.id),
  };
  return {
    id: row.id,
    name: row.name,
    city: row.city,
    serviceArea: (typeof row.serviceArea === 'string' ? row.serviceArea.trim() : '') || row.city,
    categories,
    hourlyRateSek: row.hourlyRateSek,
    bio: row.bio,
    // Schools: no logo or scraped site art in public JSON (third-party IP).
    photoUrl: row.providerRole === 'SCHOOL' ? '' : row.photoUrl,
    englishSpeaking: row.englishSpeaking === true,
    languages: row.englishSpeaking === true ? (['sv', 'en'] as const) : (['sv'] as const),
    verificationStatus: aggregate.verificationStatus,
    reviewSummary: aggregate.reviewSummary,
    // Google Places snapshot (cached; the backfill job refreshes weekly).
    googleRating: row.googleRating ?? null,
    googleReviewCount: row.googleReviewCount ?? null,
    googleMapsUri: row.googleMapsUri ?? null,
    googleReviews: aggregate.googleReviews ?? [],
    publishedPrices: prices,
    nextSlotAt,
    cancellationPolicyTier:
      row.cancellationPolicyTier === 'moderate' || row.cancellationPolicyTier === 'strict'
        ? row.cancellationPolicyTier
        : row.cancellationPolicyTier === 'flexible'
          ? 'flexible'
          : null,
    bookingMode: publishedBookingMode(row.bookingMode),
    // Raw marketplace kind as stored (SCHOOL | INSTRUCTOR | HANDLEDARE) — a
    // school-owned listing reports SCHOOL (QA 2026-10-13: the previous
    // collapse made /api/instructors describe every school as INSTRUCTOR).
    // The contract's PublicProviderRoleEnum accepts all three kinds.
    providerRole:
      row.providerRole === 'SCHOOL' || row.providerRole === 'HANDLEDARE'
        ? row.providerRole
        : 'INSTRUCTOR',
    // Additive alias of `providerRole`, retained so existing readers of the
    // field keep parsing unchanged.
    providerType:
      row.providerRole === 'SCHOOL' || row.providerRole === 'HANDLEDARE'
        ? row.providerRole
        : 'INSTRUCTOR',
    phone: row.providerRole === 'SCHOOL' ? phoneFact(publishedPhone(row.id)) : null,
    contact: resolveSchoolContact(contactInput),
    priceRequest: hasWebsitePrice(prices) ? null : resolvePriceRequest(contactInput),
    ...(distanceKm == null ? {} : { distanceKm }),
  };
}

export function hasCanonicalCategory(row: PublicInstructorSource): boolean {
  return isProviderActivated(row.categories);
}
