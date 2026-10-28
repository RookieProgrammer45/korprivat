import { robotsConfig } from '@/lib/robots-config';
import { siteUrl } from '@/lib/site';

export function isIndexableDeploy(): boolean {
  return process.env.SEO_INDEXABLE === 'true';
}

export function isSitemapDisallowed(path: string): boolean {
  return robotsConfig.disallow.some((rule) => {
    if (rule.endsWith('/')) return path === rule.slice(0, -1) || path.startsWith(rule);
    return path === rule || path.startsWith(`${rule}/`);
  });
}

export function renderRobotsTxt(): string {
  if (!isIndexableDeploy()) {
    return ['User-agent: *', 'Disallow: /', ''].join('\n');
  }

  return [
    'User-agent: *',
    'Allow: /',
    ...robotsConfig.disallow.map((path) => `Disallow: ${path}`),
    '',
    `Host: ${siteUrl}`,
    `Sitemap: ${siteUrl}/sitemap.xml`,
    '',
  ].join('\n');
}
