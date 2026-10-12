import { defaultLocale, isLocale, type Locale } from '@/i18n/config';

/** Locale cookie name is repeated here so this client-safe helper never imports
 * `@/lib/i18n`, which reads request cookies through `next/headers`. */
const LOCALE_COOKIE = 'NEXT_LOCALE';

export function normalizePublicLocale(value: unknown): Locale {
  return typeof value === 'string' && isLocale(value) ? value : defaultLocale;
}

/**
 * Read the browser-visible locale cookie defensively. This is only for the
 * provider-less global error boundary; unknown or malformed values must retain
 * the Swedish default rather than becoming document metadata.
 */
export function publicLocaleFromCookie(cookieHeader: string | null | undefined): Locale {
  const cookie = cookieHeader
    ?.split(';')
    .map((entry) => entry.trim())
    .find((entry) => entry.startsWith(`${LOCALE_COOKIE}=`));

  if (!cookie) return defaultLocale;

  try {
    return normalizePublicLocale(decodeURIComponent(cookie.slice(LOCALE_COOKIE.length + 1)));
  } catch {
    return defaultLocale;
  }
}

export function documentLocaleAttributes(value: unknown): { lang: Locale; dir: 'ltr' } {
  return { lang: normalizePublicLocale(value), dir: 'ltr' };
}

/**
 * Global errors replace the provider that ordinarily reads messages. Keep this
 * intentionally small client-safe fallback synchronized with `publicRecovery`
 * in both locale message files.
 */
export const globalErrorFallback = {
  sv: {
    title: 'Något gick fel',
    description: 'Ett kritiskt fel uppstod. Försök igen.',
    action: 'Försök igen',
  },
  en: {
    title: 'Something went wrong',
    description: 'A critical error occurred. Please try again.',
    action: 'Try again',
  },
} as const satisfies Record<Locale, { title: string; description: string; action: string }>;
