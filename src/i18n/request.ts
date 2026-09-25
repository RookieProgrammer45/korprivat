// @polsia:framework-owned — do NOT edit. Locale comes from the cookie (via
// @/lib/i18n), not the URL. Add locales in src/i18n/config.ts + messages/<locale>.json.
import { getRequestConfig } from 'next-intl/server';
import { resolveLocale } from '@/lib/i18n';

export default getRequestConfig(async () => {
  const locale = await resolveLocale();

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
