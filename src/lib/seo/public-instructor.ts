import 'server-only';
import { isMarketplaceSchoolRole, isProviderActivated } from '@/lib/business/provider-activation';
import { prisma } from '@/lib/db';
import { hasPublishedPrices, publishedListingWhere } from '@/lib/discovery/published-prices';
import { parseSchoolSlug, schoolPath } from '@/lib/seo/school-slugs';

export type PublicInstructorSeo = {
  id: string;
  name: string;
  city: string;
  bio: string;
  hourlyRateSek: number;
  categories: string[];
  photoUrl: string;
  englishSpeaking: boolean;
  indexable: boolean;
  userId: string | null;
  providerRole: string | null;
  // 'contact' = directory-only: the school page hides the booking sidebar
  // and offering request forms for this row (school restriction workflow).
  bookingMode: 'instant' | 'request' | 'contact';
};

export async function loadPublicInstructorSeo(id: string): Promise<PublicInstructorSeo | null> {
  const row = await prisma.instructor.findUnique({
    where: { id },
    select: {
      id: true,
      userId: true,
      name: true,
      city: true,
      bio: true,
      hourlyRateSek: true,
      categories: true,
      photoUrl: true,
      englishSpeaking: true,
      providerRole: true,
      bookingMode: true,
    },
  });
  if (!row || !hasPublishedPrices(row.id)) return null;

  const license = row.userId
    ? await prisma.instructorLicense.findUnique({
        where: { userId: row.userId },
        select: { status: true },
      })
    : null;

  const indexable =
    isProviderActivated(row.categories) &&
    isMarketplaceSchoolRole(row.providerRole) &&
    license?.status === 'VERIFIED';

  return {
    id: row.id,
    name: row.name,
    city: row.city,
    bio: row.bio,
    hourlyRateSek: row.hourlyRateSek,
    categories: row.categories,
    photoUrl: row.photoUrl,
    englishSpeaking: row.englishSpeaking,
    indexable,
    userId: row.userId,
    providerRole: row.providerRole,
    bookingMode:
      row.bookingMode === 'request'
        ? 'request'
        : row.bookingMode === 'contact'
          ? 'contact'
          : 'instant',
  };
}

/** Verified marketplace listings for sitemap (cap keeps build bounded). */
export async function listIndexableInstructorIds(limit = 500): Promise<string[]> {
  const verified = await prisma.instructorLicense.findMany({
    where: { status: 'VERIFIED' },
    select: { userId: true },
    take: limit,
  });
  if (verified.length === 0) return [];
  const rows = await prisma.instructor.findMany({
    where: {
      userId: { in: verified.map((v) => v.userId) },
      OR: [{ providerRole: null }, { providerRole: { not: 'HANDLEDARE' } }],
      AND: [publishedListingWhere()],
    },
    select: { id: true, categories: true },
    take: limit,
  });
  return rows.filter((r) => isProviderActivated(r.categories)).map((r) => r.id);
}

/** Full SEO rows for verified marketplace listings (crawlable directory index). */
export async function listIndexableInstructors(limit = 200) {
  const verified = await prisma.instructorLicense.findMany({
    where: { status: 'VERIFIED' },
    select: { userId: true },
    take: limit,
  });
  if (verified.length === 0) return [];
  const rows = await prisma.instructor.findMany({
    where: {
      userId: { in: verified.map((v) => v.userId) },
      OR: [{ providerRole: null }, { providerRole: { not: 'HANDLEDARE' } }],
      AND: [publishedListingWhere()],
    },
    select: {
      id: true,
      name: true,
      city: true,
      bio: true,
      hourlyRateSek: true,
      categories: true,
    },
    orderBy: { name: 'asc' },
    take: limit,
  });
  return rows.filter((r) => isProviderActivated(r.categories));
}

export type PublicInstructorSlugResult = {
  instructor: PublicInstructorSeo;
  canonicalPath: string;
};

/**
 * Resolves /trafikskola/<city>/<name>-<id8> to its instructor row.
 * `canonicalPath` lets the page 308 any non-canonical spelling (wrong city,
 * renamed school, missing id suffix) onto the right URL.
 */
export async function loadPublicInstructorBySchoolSlug(
  slug: string,
): Promise<PublicInstructorSlugResult | null> {
  const parsed = parseSchoolSlug(slug);
  if (!parsed) return null;
  const row = await prisma.instructor.findFirst({
    where: { id: { startsWith: parsed.id8 } },
    select: { id: true },
    orderBy: { name: 'asc' },
  });
  if (!row) return null;
  const instructor = await loadPublicInstructorSeo(row.id);
  if (!instructor) return null;
  return { instructor, canonicalPath: schoolPath(instructor) };
}
