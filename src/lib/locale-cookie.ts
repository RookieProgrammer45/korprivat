// Client-side NEXT_LOCALE writer. The cookie is not HttpOnly (see
// POST /api/locale), so we can set it before navigation and avoid waiting on
// the API round-trip. The API call still runs in the background for parity.
import { isLocale } from '@/i18n/config';
import { LOCALE_COOKIE } from '@/lib/i18n';

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

export function writeLocaleCookie(locale: string): boolean {
  if (typeof document === 'undefined' || !isLocale(locale)) return false;
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  // biome-ignore lint/suspicious/noDocumentCookie: NEXT_LOCALE is not HttpOnly; set before navigate so locale switch is not blocked on /api/locale.
  document.cookie = `${LOCALE_COOKIE}=${encodeURIComponent(locale)}; Path=/; Max-Age=${ONE_YEAR_SECONDS}; SameSite=Lax${secure}`;
  return true;
}
