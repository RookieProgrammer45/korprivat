// Programmatic SEO routes merged into /sitemap.xml. Prefer the Nordic
// locations registry over one-off city files — add a row in nordic-locations.ts.
import type { MetadataRoute } from 'next';
import { catalogueWebsiteDown, listCatalogueSchools } from '@/lib/discovery/nordic-catalogue';
import { publishedLessonCountForCities } from '@/lib/discovery/published-prices';
import { indexableLocationPaths } from '@/lib/seo/catalogue-locations';
import { isLessonComparisonEligible, lessonComparisonPath } from '@/lib/seo/lesson-comparison-path';
import { NORDIC_LOCATIONS } from '@/lib/seo/nordic-locations';
import { listIndexableInstructors } from '@/lib/seo/public-instructor';
import { schoolPath } from '@/lib/seo/school-slugs';

/** App-absolute `path` (e.g. /items/aatrox) + optional Next sitemap fields. */
export type SeoRoute = { path: string } & Omit<MetadataRoute.Sitemap[number], 'url'>;

const EDITORIAL: SeoRoute[] = [
  {
    path: '/blog/korkort-b-malmo',
    priority: 0.75,
    changeFrequency: 'monthly',
    lastModified: '2026-11-16',
  },
  {
    path: '/blog/korkort-b-goteborg',
    priority: 0.75,
    changeFrequency: 'monthly',
    lastModified: '2026-11-11',
  },
  {
    path: '/blog/korlektion-korkort-b',
    priority: 0.75,
    changeFrequency: 'monthly',
    lastModified: '2026-11-09',
  },
  {
    path: '/blog/korkortstillstand-korkort-b',
    priority: 0.75,
    changeFrequency: 'monthly',
    lastModified: '2026-11-04',
  },
  {
    path: '/blog/riskutbildning-korkort-b',
    priority: 0.75,
    changeFrequency: 'monthly',
    lastModified: '2026-11-02',
  },
  {
    path: '/blog/korprov-korkort-b',
    priority: 0.75,
    changeFrequency: 'monthly',
    lastModified: '2026-10-28',
  },
  { path: '/southern-sweden', priority: 0.8, changeFrequency: 'weekly' },
  { path: '/western-northern-sweden', priority: 0.8, changeFrequency: 'weekly' },
  { path: '/handledare', priority: 0.8, changeFrequency: 'monthly' },
  { path: '/pricing', priority: 0.7, changeFrequency: 'monthly' },
  { path: '/bilhandlare', priority: 0.8, changeFrequency: 'weekly' },
  { path: '/reservdelar', priority: 0.8, changeFrequency: 'weekly' },
  { path: '/faq', priority: 0.6, changeFrequency: 'monthly' },
  { path: '/for-skolor', priority: 0.7, changeFrequency: 'monthly' },
  { path: '/for-instructors', priority: 0.6, changeFrequency: 'monthly' },
  { path: '/om-oss', priority: 0.6, changeFrequency: 'monthly' },
  { path: '/contact', priority: 0.5, changeFrequency: 'monthly' },
  { path: '/blog', priority: 0.6, changeFrequency: 'weekly' },
  {
    path: '/blog/kunskapsprov-korkort-b',
    priority: 0.75,
    changeFrequency: 'monthly',
    lastModified: '2026-10-26',
  },
  {
    path: '/blog/korkort-b-steg-for-steg',
    priority: 0.75,
    changeFrequency: 'monthly',
    lastModified: '2026-10-26',
  },
  {
    path: '/blog/swedish-drivers-license-expat-stockholm',
    priority: 0.7,
    changeFrequency: 'monthly',
  },
  {
    path: '/blog/handledare-ovningskorning-sverige',
    priority: 0.75,
    changeFrequency: 'monthly',
  },
  {
    path: '/blog/kostnad-korkort-sverige',
    priority: 0.75,
    changeFrequency: 'monthly',
  },
  {
    path: '/blog/trafikskola-eller-handledare',
    priority: 0.75,
    changeFrequency: 'monthly',
  },
];

/** One sitemap file holds at most 50,000 URLs; the catalogue routes share it. */
const MAX_SITEMAP_SCHOOLS = 20_000;

function filterCitiesFor(location: (typeof NORDIC_LOCATIONS)[number]): string[] {
  if (typeof location.filterCity === 'string') return [location.filterCity];
  if (location.filterCity) return [...location.filterCity];
  return [location.name];
}

export async function seoRoutes(): Promise<SeoRoute[]> {
  const locationRoutes: SeoRoute[] = indexableLocationPaths().map((path) => ({
    path,
    priority: path === '/locations' ? 0.85 : path.split('/').length <= 3 ? 0.8 : 0.7,
    changeFrequency: 'weekly' as const,
  }));

  // PriceRunner pages: only cities with enough ordinary website lesson prices.
  const lessonComparisonRoutes: SeoRoute[] = NORDIC_LOCATIONS.filter((location) => {
    if (location.country !== 'se' || location.kind !== 'city' || !location.marketplaceLive) {
      return false;
    }
    return isLessonComparisonEligible(publishedLessonCountForCities(filterCitiesFor(location)));
  }).map((location) => ({
    path: lessonComparisonPath(location),
    priority: 0.85,
    changeFrequency: 'weekly' as const,
  }));

  const catalogueRoutes: SeoRoute[] = listCatalogueSchools()
    .filter((school) => !catalogueWebsiteDown(school.id))
    .map((school) => ({
      path: schoolPath(school),
      priority: 0.65,
      changeFrequency: 'weekly' as const,
    }));

  let instructorRoutes: SeoRoute[] = [];
  try {
    const rows = await listIndexableInstructors(MAX_SITEMAP_SCHOOLS);
    instructorRoutes = rows.map((row) => ({
      path: schoolPath(row),
      priority: 0.65,
      changeFrequency: 'weekly' as const,
    }));
  } catch {
    instructorRoutes = [];
  }

  return [
    ...EDITORIAL,
    ...locationRoutes,
    ...lessonComparisonRoutes,
    ...catalogueRoutes,
    ...instructorRoutes,
  ];
}
