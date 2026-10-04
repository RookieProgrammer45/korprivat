// Programmatic SEO routes merged into /sitemap.xml. Prefer the Nordic
// locations registry over one-off city files — add a row in nordic-locations.ts.
import type { MetadataRoute } from 'next';
import { allLocationSitemapPaths } from '@/lib/seo/nordic-locations';
import { listIndexableInstructorIds } from '@/lib/seo/public-instructor';

/** App-absolute `path` (e.g. /items/aatrox) + optional Next sitemap fields. */
export type SeoRoute = { path: string } & Omit<MetadataRoute.Sitemap[number], 'url'>;

const EDITORIAL: SeoRoute[] = [
  { path: '/southern-sweden', priority: 0.8, changeFrequency: 'weekly' },
  { path: '/western-northern-sweden', priority: 0.8, changeFrequency: 'weekly' },
  { path: '/handledare', priority: 0.8, changeFrequency: 'monthly' },
  { path: '/pricing', priority: 0.7, changeFrequency: 'monthly' },
  { path: '/faq', priority: 0.6, changeFrequency: 'monthly' },
  { path: '/for-skolor', priority: 0.7, changeFrequency: 'monthly' },
  { path: '/blog', priority: 0.6, changeFrequency: 'weekly' },
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
  // Legacy city URLs 308 to /locations/se/* — keep briefly for crawlers that
  // still hold the old sitemap entries.
  { path: '/instructors/stockholm', priority: 0.3, changeFrequency: 'yearly' },
  { path: '/instructors/goteborg', priority: 0.3, changeFrequency: 'yearly' },
  { path: '/instructors/malmo', priority: 0.3, changeFrequency: 'yearly' },
  { path: '/instructors/uppsala', priority: 0.3, changeFrequency: 'yearly' },
  { path: '/instructors/vasteras', priority: 0.3, changeFrequency: 'yearly' },
];

export async function seoRoutes(): Promise<SeoRoute[]> {
  const locationRoutes: SeoRoute[] = allLocationSitemapPaths().map((path) => ({
    path,
    priority: path === '/locations' ? 0.85 : path.split('/').length <= 3 ? 0.8 : 0.7,
    changeFrequency: 'weekly' as const,
  }));

  let instructorRoutes: SeoRoute[] = [];
  try {
    const ids = await listIndexableInstructorIds(500);
    instructorRoutes = ids.map((id) => ({
      path: `/instructors/${id}`,
      priority: 0.65,
      changeFrequency: 'weekly' as const,
    }));
  } catch {
    instructorRoutes = [];
  }

  return [...EDITORIAL, ...locationRoutes, ...instructorRoutes];
}
