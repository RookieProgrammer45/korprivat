// Shared canonical + hreflang for public marketing URLs.
// Locale is cookie-based (sv default for crawlers); languages map the same
// www URL so Search Console still sees sv-SE / en / x-default explicitly.

import { siteUrl } from '@/lib/site';

export function absoluteUrl(path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${siteUrl}${normalized}`;
}

export function publicAlternates(path: string): {
  canonical: string;
  languages: Record<string, string>;
} {
  const url = absoluteUrl(path);
  return {
    canonical: path.startsWith('/') ? path : `/${path}`,
    languages: {
      'sv-SE': url,
      en: url,
      'x-default': url,
    },
  };
}
