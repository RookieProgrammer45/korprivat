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

/** Public school search: a chosen city opens that hub; otherwise Sweden. */
export function schoolSearchPath(cityValue: string): string {
  const wanted = cityValue.trim();
  if (!wanted) return '/locations/se';
  const match = SEARCH_CITIES.find((city) => city.value === wanted);
  return match?.href ?? '/locations/se';
}
