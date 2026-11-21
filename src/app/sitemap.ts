// General routes use the existing locale policy. English-only editorial routes
// are supplied separately to preserve their canonical /en prefix.
import type { MetadataRoute } from 'next';
import { navItems } from '@/lib/nav';
import { isSitemapDisallowed } from '@/lib/robots-txt';
import { englishEditorialPaths } from '@/lib/seo/english-editorial';
import { sitemapPathsFor } from '@/lib/seo/locale-path';
import { seoRoutes } from '@/lib/seo-routes';
import { siteUrl } from '@/lib/site';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const seen = new Set<string>();
  const entries: MetadataRoute.Sitemap = [];

  const addCanonical = (path: string, extra: Omit<MetadataRoute.Sitemap[number], 'url'>) => {
    if (!path.startsWith('/') || path.includes('#')) return;
    if (isSitemapDisallowed(path) || seen.has(path)) return;
    seen.add(path);
    entries.push({ url: `${siteUrl}${path}`, ...extra });
  };

  const add = (path: string, extra: Omit<MetadataRoute.Sitemap[number], 'url'>) => {
    if (!path.startsWith('/') || path.includes('#')) return;
    if (isSitemapDisallowed(path)) return;
    for (const localized of sitemapPathsFor(path)) {
      addCanonical(localized, extra);
    }
  };

  add('/', { changeFrequency: 'weekly', priority: 1 });

  for (const item of navItems) {
    if (item.requiresAuth) continue;
    if (item.catalogGated) continue;
    add(item.href, { changeFrequency: 'weekly', priority: 0.7 });
  }

  for (const route of await seoRoutes()) {
    const { path, ...meta } = route;
    add(path, { changeFrequency: 'weekly', priority: 0.6, ...meta });
  }

  for (const path of englishEditorialPaths()) {
    addCanonical(path, { changeFrequency: 'monthly', priority: 0.7 });
  }

  return entries;
}
