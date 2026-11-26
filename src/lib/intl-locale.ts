// BCP-47 tag for dates and numbers. Client-safe: no next/headers.
const INTL_LOCALE: Record<string, string> = {
  sv: 'sv-SE',
  en: 'en-GB',
  nb: 'nb-NO',
  da: 'da-DK',
  fi: 'fi-FI',
  de: 'de-DE',
  fr: 'fr-FR',
  nl: 'nl-NL',
  es: 'es-ES',
  it: 'it-IT',
  pl: 'pl-PL',
};

export function intlLocale(locale: string): string {
  return INTL_LOCALE[locale] ?? 'sv-SE';
}
