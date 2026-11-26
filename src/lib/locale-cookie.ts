// Client-side NEXT_LOCALE writer. The cookie is not HttpOnly (see
// POST /api/locale), so we can set it before navigation and avoid waiting on
// the API round-trip. Keep this module free of next/headers: the language
// switcher is a client component.
import { isLocale } from '@/i18n/config';

export const LOCALE_COOKIE = 'NEXT_LOCALE';

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

export function writeLocaleCookie(locale: string): boolean {
  if (typeof document === 'undefined' || !isLocale(locale)) return false;
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  // biome-ignore lint/suspicious/noDocumentCookie: NEXT_LOCALE is not HttpOnly; set before navigate so locale switch is not blocked on /api/locale.
  document.cookie = `${LOCALE_COOKIE}=${encodeURIComponent(locale)}; Path=/; Max-Age=${ONE_YEAR_SECONDS}; SameSite=Lax${secure}`;
  return true;
}
