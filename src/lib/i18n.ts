// only allowed under src/lib/**, so the read lives here (not in src/i18n/request.ts).
import { cookies } from 'next/headers';
import { defaultLocale, isLocale } from '@/i18n/config';

export const LOCALE_COOKIE = 'NEXT_LOCALE';

// Cookie locale if valid, else defaultLocale (cookieless requests + crawlers).
export async function resolveLocale(): Promise<string> {
  const requested = (await cookies()).get(LOCALE_COOKIE)?.value;
  return requested && isLocale(requested) ? requested : defaultLocale;
}
