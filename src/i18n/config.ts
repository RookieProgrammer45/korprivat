// messages/<locale>.json with the SAME keys as every other locale file (a missing
// key throws MISSING_MESSAGE). `defaultLocale` is what `/` and unknown locales use.
// Swedish URLs stay unprefixed; other locales use /{locale}/... (see locale-path).
export const locales = ['sv', 'en', 'nb', 'da', 'fi', 'de', 'fr', 'nl', 'es', 'it', 'pl'] as const;

export type Locale = (typeof locales)[number];

// Swedish is the install-time default (DriveLinkUp is launching in Sweden;
// bare-cookie / cookieless visitors — crawlers included — see SV.)
export const defaultLocale: Locale = 'sv';

export function isLocale(value: string): value is Locale {
  return (locales as readonly string[]).includes(value);
}
