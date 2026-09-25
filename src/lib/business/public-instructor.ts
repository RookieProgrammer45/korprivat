// @polsia:user-owned — safe public instructor facts shared by list/detail routes.
import 'server-only';
import { isProviderActivated } from '@/lib/business/provider-activation';
import { prisma } from '@/lib/db';

export type PublicInstructorAggregate = {
  verificationStatus: 'verified' | 'pending' | 'rejected' | 'unverified';
  reviewSummary: { count: number; averageRating: number | null };
};

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
};

type ReviewRow = { instructorId: string; rating: number };
type LicenseRow = { userId: string; status: string };

export async function loadPublicInstructorAggregates(
  rows: Array<Pick<PublicInstructorSource, 'id' | 'userId'>>,
): Promise<Map<string, PublicInstructorAggregate>> {
  const result = new Map<string, PublicInstructorAggregate>();
  const instructorIds = rows.map((row) => row.id);
  const userIds = rows.flatMap((row) => (row.userId ? [row.userId] : []));

  const [licenses, reviews] = await Promise.all([
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
  const categories = row.categories.filter((category) => isProviderActivated([category]));
  return {
    id: row.id,
    name: row.name,
    city: row.city,
    serviceArea: (typeof row.serviceArea === 'string' ? row.serviceArea.trim() : '') || row.city,
    categories,
    hourlyRateSek: row.hourlyRateSek,
    bio: row.bio,
    photoUrl: row.photoUrl,
    englishSpeaking: row.englishSpeaking === true,
    languages: row.englishSpeaking === true ? (['sv', 'en'] as const) : (['sv'] as const),
    verificationStatus: aggregate.verificationStatus,
    reviewSummary: aggregate.reviewSummary,
    nextSlotAt,
    cancellationPolicyTier:
      row.cancellationPolicyTier === 'moderate' || row.cancellationPolicyTier === 'strict'
        ? row.cancellationPolicyTier
        : row.cancellationPolicyTier === 'flexible'
          ? 'flexible'
          : null,
    bookingMode: row.bookingMode === 'request' ? 'request' : 'instant',
    providerRole: row.providerRole === 'HANDLEDARE' ? 'HANDLEDARE' : 'INSTRUCTOR',
    ...(distanceKm == null ? {} : { distanceKm }),
  };
}

export function hasCanonicalCategory(row: PublicInstructorSource): boolean {
  return isProviderActivated(row.categories);
}
