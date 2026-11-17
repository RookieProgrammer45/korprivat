import { defaultLocale, isLocale, type Locale, locales } from '@/i18n/config';

/** Request header set by proxy.ts when rewriting a prefixed locale URL. */
export const LOCALE_HEADER = 'x-locale';

export const localeHreflang: Record<Locale, string> = {
  sv: 'sv-SE',
  en: 'en',
  nb: 'nb-NO',
  da: 'da-DK',
  fi: 'fi-FI',
  de: 'de',
  fr: 'fr',
  nl: 'nl',
  es: 'es',
  it: 'it',
  pl: 'pl',
};

export const localeHtmlLang: Record<Locale, string> = {
  sv: 'sv',
  en: 'en',
  nb: 'nb',
  da: 'da',
  fi: 'fi',
  de: 'de',
  fr: 'fr',
  nl: 'nl',
  es: 'es',
  it: 'it',
  pl: 'pl',
};

export function normalizePath(path: string): string {
  if (!path || path === '/') return '/';
  const withSlash = path.startsWith('/') ? path : `/${path}`;
  return withSlash.length > 1 && withSlash.endsWith('/') ? withSlash.slice(0, -1) : withSlash;
}

export function parseLocalePrefix(pathname: string): {
  locale: Locale;
  pathname: string;
  hadPrefix: boolean;
} {
  const normalized = normalizePath(pathname);
  const segments = normalized.split('/');
  const maybe = segments[1];
  if (maybe && isLocale(maybe)) {
    const rest = `/${segments.slice(2).join('/')}`.replace(/\/+$/, '');
    return {
      locale: maybe,
      pathname: rest === '' ? '/' : rest,
      hadPrefix: true,
    };
  }
  return { locale: defaultLocale, pathname: normalized, hadPrefix: false };
}

function splitPathSuffix(path: string): { pathname: string; suffix: string } {
  const cut = path.search(/[?#]/);
  if (cut === -1) return { pathname: path, suffix: '' };
  return { pathname: path.slice(0, cut) || '/', suffix: path.slice(cut) };
}

export function localePath(locale: string, path: string): string {
  const { pathname, suffix } = splitPathSuffix(path);
  const { pathname: bare } = parseLocalePrefix(pathname || '/');
  const prefixed =
    !isLocale(locale) || locale === defaultLocale
      ? bare
      : bare === '/'
        ? `/${locale}`
        : `/${locale}${bare}`;
  return `${prefixed}${suffix}`;
}

export function switchLocalePath(currentPathname: string, nextLocale: string, search = ''): string {
  const { pathname, suffix } = splitPathSuffix(currentPathname);
  const { pathname: bare } = parseLocalePrefix(pathname || '/');
  const extra =
    suffix ||
    (search ? (search.startsWith('?') || search.startsWith('#') ? search : `?${search}`) : '');
  return localePath(nextLocale, `${bare}${extra}`);
}

export type LocaleProxyDecision =
  | { action: 'next' }
  | { action: 'redirect'; pathname: string }
  | { action: 'rewrite'; pathname: string; locale: Locale };

export function localeProxyDecision(pathname: string): LocaleProxyDecision {
  const parsed = parseLocalePrefix(pathname);
  if (!parsed.hadPrefix) return { action: 'next' };
  if (parsed.locale === defaultLocale) {
    return { action: 'redirect', pathname: parsed.pathname };
  }
  return { action: 'rewrite', pathname: parsed.pathname, locale: parsed.locale };
}

export function isSchoolProfilePath(path: string): boolean {
  const { pathname } = parseLocalePrefix(path);
  return pathname.startsWith('/trafikskola/') || pathname.startsWith('/schools/');
}

/** Swedish-only bodies (guides) stay unprefixed in the sitemap. */
export function isSwedishOnlySeoPath(path: string): boolean {
  const { pathname } = parseLocalePrefix(path);
  return pathname.startsWith('/blog/') && pathname !== '/blog';
}

/** Swedish URL plus prefixed locales, except school profiles and Swedish-only guides. */
const COUNTRY_LOCALE: Record<string, string> = {
  se: 'sv',
  no: 'nb',
  dk: 'da',
  fi: 'fi',
  de: 'de',
  at: 'de',
  ch: 'de',
  fr: 'fr',
  be: 'fr',
  lu: 'fr',
  nl: 'nl',
  es: 'es',
  it: 'it',
  pl: 'pl',
};

export function sitemapPathsFor(path: string): string[] {
  const { pathname } = parseLocalePrefix(path);
  if (isSchoolProfilePath(pathname) || isSwedishOnlySeoPath(pathname)) return [pathname];
  const hub = /^\/locations\/([a-z]{2})(?:\/|$)/.exec(pathname);
  if (hub) {
    // Location hubs: Swedish, English and the market's own language only.
    // Emitting all 11 locales per city produced ~8,700 near-duplicate URLs.
    const wanted = new Set<string>([defaultLocale, 'en', COUNTRY_LOCALE[hub[1] ?? ''] ?? 'en']);
    return locales.filter((l) => wanted.has(l)).map((locale) => localePath(locale, pathname));
  }
  return locales.map((locale) => localePath(locale, pathname));
}
