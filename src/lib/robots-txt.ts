import { defaultLocale, locales } from '@/i18n/config';
import { robotsConfig } from '@/lib/robots-config';
import { parseLocalePrefix } from '@/lib/seo/locale-path';
import { siteUrl } from '@/lib/site';

export function isIndexableDeploy(): boolean {
  return process.env.SEO_INDEXABLE === 'true';
}

export function isSitemapDisallowed(path: string): boolean {
  const unprefixed = parseLocalePrefix(path).pathname;
  return robotsConfig.disallow.some((rule) => {
    if (rule.endsWith('/')) {
      return unprefixed === rule.slice(0, -1) || unprefixed.startsWith(rule);
    }
    return unprefixed === rule || unprefixed.startsWith(`${rule}/`);
  });
}

export function disallowLines(): string[] {
  const lines = robotsConfig.disallow.map((rule) => `Disallow: ${rule}`);
  for (const locale of locales) {
    if (locale === defaultLocale) continue;
    for (const rule of robotsConfig.disallow) {
      const suffix = rule.startsWith('/') ? rule : `/${rule}`;
      lines.push(`Disallow: /${locale}${suffix}`);
    }
  }
  return lines;
}

export function renderRobotsTxt(): string {
  if (!isIndexableDeploy()) {
    return ['User-agent: *', 'Disallow: /', ''].join('\n');
  }

  return [
    'User-agent: *',
    'Allow: /',
    ...disallowLines(),
    '',
    `Host: ${siteUrl}`,
    `Sitemap: ${siteUrl}/sitemap.xml`,
    '',
  ].join('\n');
}
