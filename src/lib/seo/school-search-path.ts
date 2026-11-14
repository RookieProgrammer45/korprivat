import { withUsualMotorcycleCategories } from '@/lib/business/licence-categories';

/** Hero licence choices. B is the default light catalogue and does not narrow the list. */
export const HERO_SEARCH_CATEGORIES = ['B', 'A', 'BE'] as const;

export type HeroSearchCategory = (typeof HERO_SEARCH_CATEGORIES)[number];

export function parseHeroSearchCategory(
  value: string | null | undefined,
): HeroSearchCategory | null {
  if (!value) return null;
  return (HERO_SEARCH_CATEGORIES as readonly string[]).includes(value)
    ? (value as HeroSearchCategory)
    : null;
}

/** A and BE narrow a listing. B and unknown values keep the full light list. */
export function heroCategoryMatches(
  categories: readonly string[],
  category: string | null | undefined,
): boolean {
  const parsed = parseHeroSearchCategory(category);
  if (!parsed || parsed === 'B') return true;
  return withUsualMotorcycleCategories(categories).includes(parsed);
}

/** Hero search cities → public location hubs. Never `/instructors` (login-walled). */

export const SEARCH_CITIES = [
  { id: 'stockholm', value: 'Stockholm', href: '/locations/se/stockholm' },
  { id: 'goteborg', value: 'Göteborg', href: '/locations/se/goteborg' },
  { id: 'malmo', value: 'Malmö', href: '/locations/se/malmo' },
  { id: 'uppsala', value: 'Uppsala', href: '/locations/se/uppsala' },
  { id: 'vasteras', value: 'Västerås', href: '/locations/se/vasteras' },
  { id: 'linkoping', value: 'Linköping', href: '/locations/se/linkoping' },
  { id: 'orebro', value: 'Örebro', href: '/locations/se/orebro' },
  { id: 'helsingborg', value: 'Helsingborg', href: '/locations/se/helsingborg' },
  { id: 'oslo', value: 'Oslo', href: '/locations/no/oslo' },
  { id: 'bergen', value: 'Bergen', href: '/locations/no/bergen' },
  { id: 'trondheim', value: 'Trondheim', href: '/locations/no/trondheim' },
  { id: 'stavanger', value: 'Stavanger', href: '/locations/no/stavanger' },
  { id: 'tromso', value: 'Tromsø', href: '/locations/no/tromso' },
  { id: 'odense', value: 'Odense', href: '/locations/dk/odense' },
  { id: 'reykjavik', value: 'Reykjavík', href: '/locations/is/reykjavik' },
  { id: 'sydney', value: 'Sydney', href: '/locations/au/sydney' },
  { id: 'melbourne', value: 'Melbourne', href: '/locations/au/melbourne' },
  { id: 'brisbane', value: 'Brisbane', href: '/locations/au/brisbane' },
  { id: 'perth', value: 'Perth', href: '/locations/au/perth' },
  { id: 'adelaide', value: 'Adelaide', href: '/locations/au/adelaide' },
  { id: 'hobart', value: 'Hobart', href: '/locations/au/hobart' },
  { id: 'goldCoast', value: 'Gold Coast', href: '/locations/au/gold-coast' },
  { id: 'london', value: 'London', href: '/locations/gb/london' },
  { id: 'manchester', value: 'Manchester', href: '/locations/gb/manchester' },
  { id: 'birmingham', value: 'Birmingham', href: '/locations/gb/birmingham' },
  { id: 'leeds', value: 'Leeds', href: '/locations/gb/leeds' },
  { id: 'glasgow', value: 'Glasgow', href: '/locations/gb/glasgow' },
  { id: 'cardiff', value: 'Cardiff', href: '/locations/gb/cardiff' },
  { id: 'madrid', value: 'Madrid', href: '/locations/es/madrid' },
  { id: 'paris', value: 'Paris', href: '/locations/fr/paris' },
  { id: 'berlin', value: 'Berlin', href: '/locations/de/berlin' },
  { id: 'roma', value: 'Roma', href: '/locations/it/roma' },
  { id: 'warszawa', value: 'Warszawa', href: '/locations/pl/warszawa' },
] as const;

/** Public school search: a chosen city opens that hub; otherwise Sweden. A and BE stay on the result. */
export function schoolSearchPath(cityValue: string, categoryValue?: string): string {
  const wanted = cityValue.trim();
  const category = parseHeroSearchCategory(categoryValue);
  const base = !wanted
    ? category && category !== 'B'
      ? '/'
      : '/locations/se'
    : (SEARCH_CITIES.find((city) => city.value === wanted)?.href ?? '/locations/se');
  if (!category || category === 'B') return base;
  return `${base}?category=${category}`;
}
