//
// /sitemap.xml — merges nav pages (src/lib/nav.ts) with programmatic routes
// (src/lib/seo-routes.ts). To add URLs, edit those companions, not this file.
// Locale prefixes are added for hubs and editorial pages; school profiles stay
// Swedish-canonical (see sitemapPathsFor).
import type { MetadataRoute } from 'next';
import { navItems } from '@/lib/nav';
import { isSitemapDisallowed } from '@/lib/robots-txt';
import { sitemapPathsFor } from '@/lib/seo/locale-path';
import { seoRoutes } from '@/lib/seo-routes';
import { siteUrl } from '@/lib/site';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const seen = new Set<string>();
  const entries: MetadataRoute.Sitemap = [];

  const add = (path: string, extra: Omit<MetadataRoute.Sitemap[number], 'url'>) => {
    if (!path.startsWith('/')) return;
    if (path.includes('#')) return;
    if (isSitemapDisallowed(path)) return;
    for (const localized of sitemapPathsFor(path)) {
      if (seen.has(localized)) continue;
      seen.add(localized);
      entries.push({ url: `${siteUrl}${localized}`, ...extra });
    }
  };

  add('/', { changeFrequency: 'weekly', priority: 1 });

  for (const item of navItems) {
    if (item.requiresAuth) continue; // auth/admin pages don't belong in the sitemap
    if (item.catalogGated) continue; // login-walled catalogues waste crawl budget
    add(item.href, { changeFrequency: 'weekly', priority: 0.7 });
  }

  for (const route of await seoRoutes()) {
    const { path, ...meta } = route;
    add(path, { changeFrequency: 'weekly', priority: 0.6, ...meta });
  }

  return entries;
}
