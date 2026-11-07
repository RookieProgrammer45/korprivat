// Shared canonical + hreflang for public marketing URLs.
// Swedish stays unprefixed; other locales use /{locale}/path so each language
// has a unique URL. x-default points at Swedish.

import { defaultLocale, locales } from '@/i18n/config';
import { resolveLocale } from '@/lib/i18n';
import { localeHreflang, localePath, normalizePath } from '@/lib/seo/locale-path';
import { siteUrl } from '@/lib/site';

export function absoluteUrl(path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${siteUrl}${normalized}`;
}

export function publicAlternates(
  path: string,
  locale: string = defaultLocale,
): {
  canonical: string;
  languages: Record<string, string>;
} {
  const unprefixed = normalizePath(path);
  const canonicalPath = localePath(locale, unprefixed);
  const languages: Record<string, string> = {
    'x-default': absoluteUrl(unprefixed),
  };
  for (const loc of locales) {
    languages[localeHreflang[loc]] = absoluteUrl(localePath(loc, unprefixed));
  }
  return {
    canonical: canonicalPath,
    languages,
  };
}

export async function publicAlternatesFor(path: string) {
  return publicAlternates(path, await resolveLocale());
}

/** Swedish-only pages (untranslated article bodies) must not claim other languages. */
export function swedishCanonicalAlternates(path: string): {
  canonical: string;
  languages: Record<string, string>;
} {
  const unprefixed = normalizePath(path);
  const url = absoluteUrl(unprefixed);
  return {
    canonical: unprefixed,
    languages: {
      'sv-SE': url,
      'x-default': url,
    },
  };
}
