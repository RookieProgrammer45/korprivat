// only allowed under src/lib/**, so the read lives here (not in src/i18n/request.ts).
import { headers } from 'next/headers';
import { defaultLocale, isLocale } from '@/i18n/config';
import { LOCALE_HEADER } from '@/lib/seo/locale-path';

export const LOCALE_COOKIE = 'NEXT_LOCALE';
export { LOCALE_HEADER };

// URL prefix (x-locale from proxy rewrite) is the only render locale so
// unprefixed Swedish URLs stay Swedish for crawlers. The cookie is still
// written by the language switcher for client round-trips.
export async function resolveLocale(): Promise<string> {
  const headerLocale = (await headers()).get(LOCALE_HEADER);
  if (headerLocale && isLocale(headerLocale)) return headerLocale;
  return defaultLocale;
}
