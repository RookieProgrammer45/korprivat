
export type MarketplaceLocale = 'en' | 'sv';

export const PROVIDER_TIME_ZONE = 'Europe/Stockholm';

export function normalizeMarketplaceLocale(locale: string): MarketplaceLocale {
  return locale === 'en' ? 'en' : 'sv';
}

export function recommendationReason({
  city,
  learnerCity,
  bookedHours,
  locale,
}: {
  city: string;
  learnerCity: string;
  bookedHours: number;
  locale: MarketplaceLocale;
}): string {
  if (locale === 'sv') {
    return city === learnerCity
      ? `${city} matchar ditt val — ${bookedHours} h övningskörning bokad.`
      : `Utanför ${learnerCity} — inom räckhåll, ${bookedHours} h övningskörning bokad.`;
  }

  return city === learnerCity
    ? `${city} matches your selection — ${bookedHours}h of practice booked.`
    : `Outside ${learnerCity} — within reach, ${bookedHours}h of practice booked.`;
}

export function genericRecommendationReason(locale: MarketplaceLocale): string {
  return locale === 'sv'
    ? 'Föreslagen utifrån tillgänglighet.'
    : 'Suggested based on availability.';
}

export type ProviderSlotDateParts = {
  day: string;
  isWithinNextWeek: boolean;
  monthShort: string;
  time: string;
  weekday: string;
};

function calendarDayInTimeZone(date: Date): number {
  const parts = new Intl.DateTimeFormat('en-CA', {
    day: 'numeric',
    month: 'numeric',
    timeZone: PROVIDER_TIME_ZONE,
    year: 'numeric',
  }).formatToParts(date);
  const valueFor = (type: string) => parts.find((part) => part.type === type)?.value;
  const year = Number(valueFor('year'));
  const month = Number(valueFor('month'));
  const day = Number(valueFor('day'));
  return Date.UTC(year, month - 1, day);
}

export function providerSlotDateParts(
  iso: string,
  locale: MarketplaceLocale,
  now = new Date(),
): ProviderSlotDateParts | null {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;

  const options = { timeZone: PROVIDER_TIME_ZONE } as const;
  const day = new Intl.DateTimeFormat(locale, { ...options, day: 'numeric' }).format(date);
  const monthShort = new Intl.DateTimeFormat(locale, { ...options, month: 'short' }).format(date);
  const time = new Intl.DateTimeFormat(locale, {
    ...options,
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
  const weekday = new Intl.DateTimeFormat(locale, { ...options, weekday: 'short' }).format(date);
  const diffDays =
    (calendarDayInTimeZone(date) - calendarDayInTimeZone(now)) / (24 * 60 * 60 * 1000);

  return {
    day,
    isWithinNextWeek: diffDays >= 0 && diffDays < 7,
    monthShort,
    time,
    weekday,
  };
}
