// Homepage school grid: same public card shape as the directory, ranked for the
// visitor's catalogue country (Vercel geo headers) up to HOMEPAGE_SCHOOL_PREVIEW_LIMIT.
import 'server-only';
import { buildVerifiedProviderActivationWhere } from '@/lib/business/provider-activation';
import { hasCanonicalCategory } from '@/lib/business/public-instructor';
import { HOMEPAGE_SCHOOL_PREVIEW_LIMIT } from '@/lib/catalog-preview';
import { type InstructorFilteredItem, LISTING_CONTACT_SELECT } from '@/lib/contracts/instructors';
import { prisma } from '@/lib/db';
import { assemblePublicDirectoryItems } from '@/lib/discovery/public-listing';
import { lightCatalogueWhere } from '@/lib/discovery/published-prices';
import {
  homepageSchoolRegionScore,
  type VisitorCatalogueRegion,
} from '@/lib/discovery/visitor-catalogue-region';
import { heroCategoryMatches, parseHeroSearchCategory } from '@/lib/seo/school-search-path';

/** Scan enough rows to fill 20 after country/region ranking. */
const WINDOW = 800;

export async function listHomepageSchools(
  limit = HOMEPAGE_SCHOOL_PREVIEW_LIMIT,
  region: VisitorCatalogueRegion = { countryCode: 'se', regionSlug: null },
  category?: string | null,
): Promise<InstructorFilteredItem[]> {
  const licence = parseHeroSearchCategory(category);
  const where = [await buildVerifiedProviderActivationWhere(), lightCatalogueWhere()];
  if (licence && licence !== 'B') where.push({ categories: { has: licence } });

  const raw = await prisma.instructor.findMany({
    where: { AND: where },
    select: LISTING_CONTACT_SELECT,
    orderBy: [{ city: 'asc' }, { name: 'asc' }],
    take: WINDOW,
  });

  const rows = raw
    .filter((row) => hasCanonicalCategory(row))
    .filter((row) => heroCategoryMatches(row.categories, category))
    .map((row) => ({ row, score: homepageSchoolRegionScore(row.id, region) }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return (
        a.row.city.localeCompare(b.row.city, 'sv') || a.row.name.localeCompare(b.row.name, 'sv')
      );
    })
    .slice(0, limit)
    .map((entry) => entry.row);

  return assemblePublicDirectoryItems(rows, { includeReviewBodies: false });
}
