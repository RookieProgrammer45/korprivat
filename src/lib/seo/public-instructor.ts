import 'server-only';
import { isMarketplaceSchoolRole, isProviderActivated } from '@/lib/business/provider-activation';
import type { InstructorFilteredItem } from '@/lib/contracts/instructors';
import { prisma } from '@/lib/db';
import {
  catalogueCountryCode,
  catalogueWebsiteDown,
  nordicInstructorByShortId,
} from '@/lib/discovery/nordic-catalogue';
import { publishedBookingMode } from '@/lib/scheduling/booking-creation';
import { marketCopy } from '@/lib/seo/market-copy';
import { isNordicCountry } from '@/lib/seo/nordic-locations';
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
  /** Website catalogue row. Indexed as a directory listing, not a verified school. */
  catalogue: boolean;
  /** ISO 3166-1 alpha-2. */
  addressCountry: string;
  contentLanguage: string;
  heavyCategories: string[];
  /** Local-language summary for catalogue schools. Null keeps the Swedish bio. */
  localDescription: string | null;
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
  if (!row) return null;

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
    bookingMode: publishedBookingMode(row.bookingMode),
    catalogue: false,
    addressCountry: 'SE',
    contentLanguage: 'sv-SE',
    heavyCategories: [],
    localDescription: null,
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
  /** Present for a website catalogue school so the page can render without a session. */
  listing: InstructorFilteredItem | null;
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
  if (/^(no|dk|fi|is|au|uk|eu|us)/.test(parsed.id8)) {
    const nordic = nordicInstructorByShortId(parsed.id8);
    if (!nordic) return null;
    const countryCode = catalogueCountryCode(nordic.id);
    const country = countryCode && isNordicCountry(countryCode) ? countryCode : null;
    const market = country ? marketCopy(country) : null;
    const heavyCategories = nordic.publishedPrices?.heavy?.categories ?? [];
    const instructor: PublicInstructorSeo = {
      id: nordic.id,
      name: nordic.name,
      city: nordic.city,
      bio: nordic.bio,
      hourlyRateSek: 0,
      categories: [...nordic.categories],
      photoUrl: nordic.photoUrl,
      englishSpeaking: nordic.englishSpeaking,
      indexable: !catalogueWebsiteDown(nordic.id),
      userId: null,
      providerRole: 'SCHOOL',
      bookingMode: 'contact',
      catalogue: true,
      addressCountry: country ? country.toUpperCase() : 'SE',
      contentLanguage: market?.schemaLang ?? 'sv-SE',
      heavyCategories: [...heavyCategories],
      localDescription: market?.schoolDescription(nordic.name, nordic.city) ?? null,
    };
    return { instructor, canonicalPath: schoolPath(instructor), listing: nordic };
  }
  const row = await prisma.instructor.findFirst({
    where: { id: { startsWith: parsed.id8 } },
    select: { id: true },
    orderBy: { name: 'asc' },
  });
  if (!row) return null;
  const instructor = await loadPublicInstructorSeo(row.id);
  if (!instructor) return null;
  return { instructor, canonicalPath: schoolPath(instructor), listing: null };
}
