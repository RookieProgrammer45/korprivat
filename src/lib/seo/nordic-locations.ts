/**
 * Scalable Nordic location registry for SEO hubs.
 * Add a city/region by appending a row — copy is templated (messages.locationHub).
 *
 * Marketplace booking remains Sweden-first (ADR-001): `marketplaceLive` is true
 * only for SE locations that can filter the live directory.
 */

export const NORDIC_COUNTRIES = ['se', 'no', 'dk', 'fi', 'is'] as const;
export type NordicCountryCode = (typeof NORDIC_COUNTRIES)[number];

export type NordicLocationKind = 'city' | 'region';

export type NordicLocation = {
  country: NordicCountryCode;
  kind: NordicLocationKind;
  slug: string;
  /** Display name (Latin script, UI default). */
  name: string;
  /** Optional native / local spelling for titles. */
  nameLocal?: string;
  /** Parent region slug within the same country (cities only). */
  regionSlug?: string;
  /** Value passed to instructor directory `city` filter when marketplaceLive. */
  filterCity?: string;
  /** SE launch market can show live listings; other Nordics are expansion hubs. */
  marketplaceLive: boolean;
};

export type NordicCountryMeta = {
  code: NordicCountryCode;
  name: string;
  nameLocal: string;
  adjective: string;
};

export const NORDIC_COUNTRY_META: Record<NordicCountryCode, NordicCountryMeta> = {
  se: { code: 'se', name: 'Sweden', nameLocal: 'Sverige', adjective: 'Swedish' },
  no: { code: 'no', name: 'Norway', nameLocal: 'Norge', adjective: 'Norwegian' },
  dk: { code: 'dk', name: 'Denmark', nameLocal: 'Danmark', adjective: 'Danish' },
  fi: { code: 'fi', name: 'Finland', nameLocal: 'Suomi', adjective: 'Finnish' },
  is: { code: 'is', name: 'Iceland', nameLocal: 'Ísland', adjective: 'Icelandic' },
};

function city(
  country: NordicCountryCode,
  slug: string,
  name: string,
  regionSlug: string,
  opts?: { filterCity?: string; nameLocal?: string; live?: boolean },
): NordicLocation {
  const live = opts?.live ?? country === 'se';
  return {
    country,
    kind: 'city',
    slug,
    name,
    nameLocal: opts?.nameLocal,
    regionSlug,
    filterCity: live ? (opts?.filterCity ?? name) : undefined,
    marketplaceLive: live,
  };
}

function region(
  country: NordicCountryCode,
  slug: string,
  name: string,
  opts?: { nameLocal?: string; live?: boolean },
): NordicLocation {
  return {
    country,
    kind: 'region',
    slug,
    name,
    nameLocal: opts?.nameLocal,
    marketplaceLive: opts?.live ?? country === 'se',
  };
}

/** Sweden: 21 län as regions + major cities across the country. */
const SE_REGIONS: NordicLocation[] = [
  region('se', 'stockholm-lan', 'Stockholm County', { nameLocal: 'Stockholms län' }),
  region('se', 'uppsala-lan', 'Uppsala County', { nameLocal: 'Uppsala län' }),
  region('se', 'sodermanland', 'Södermanland', { nameLocal: 'Södermanlands län' }),
  region('se', 'ostergotland', 'Östergötland', { nameLocal: 'Östergötlands län' }),
  region('se', 'jonkoping-lan', 'Jönköping County', { nameLocal: 'Jönköpings län' }),
  region('se', 'kronoberg', 'Kronoberg', { nameLocal: 'Kronobergs län' }),
  region('se', 'kalmar-lan', 'Kalmar County', { nameLocal: 'Kalmar län' }),
  region('se', 'gotland', 'Gotland', { nameLocal: 'Gotlands län' }),
  region('se', 'blekinge', 'Blekinge', { nameLocal: 'Blekinge län' }),
  region('se', 'skane', 'Skåne', { nameLocal: 'Skåne län' }),
  region('se', 'halland', 'Halland', { nameLocal: 'Hallands län' }),
  region('se', 'vastra-gotaland', 'Västra Götaland', { nameLocal: 'Västra Götalands län' }),
  region('se', 'varmland', 'Värmland', { nameLocal: 'Värmlands län' }),
  region('se', 'orebro-lan', 'Örebro County', { nameLocal: 'Örebro län' }),
  region('se', 'vastmanland', 'Västmanland', { nameLocal: 'Västmanlands län' }),
  region('se', 'dalarna', 'Dalarna', { nameLocal: 'Dalarnas län' }),
  region('se', 'gavleborg', 'Gävleborg', { nameLocal: 'Gävleborgs län' }),
  region('se', 'vasternorrland', 'Västernorrland', { nameLocal: 'Västernorrlands län' }),
  region('se', 'jamtland', 'Jämtland', { nameLocal: 'Jämtlands län' }),
  region('se', 'vasterbotten', 'Västerbotten', { nameLocal: 'Västerbottens län' }),
  region('se', 'norrbotten', 'Norrbotten', { nameLocal: 'Norrbottens län' }),
];

const SE_CITIES: NordicLocation[] = [
  city('se', 'stockholm', 'Stockholm', 'stockholm-lan'),
  city('se', 'sodertalje', 'Södertälje', 'stockholm-lan'),
  city('se', 'solna', 'Solna', 'stockholm-lan'),
  city('se', 'nacka', 'Nacka', 'stockholm-lan'),
  city('se', 'huddinge', 'Huddinge', 'stockholm-lan'),
  city('se', 'uppsala', 'Uppsala', 'uppsala-lan'),
  city('se', 'enkoping', 'Enköping', 'uppsala-lan', { filterCity: 'Enköping' }),
  city('se', 'eskilstuna', 'Eskilstuna', 'sodermanland'),
  city('se', 'nykoping', 'Nyköping', 'sodermanland', { filterCity: 'Nyköping' }),
  city('se', 'linkoping', 'Linköping', 'ostergotland', { filterCity: 'Linköping' }),
  city('se', 'norrkoping', 'Norrköping', 'ostergotland', { filterCity: 'Norrköping' }),
  city('se', 'jonkoping', 'Jönköping', 'jonkoping-lan', { filterCity: 'Jönköping' }),
  city('se', 'varnamo', 'Värnamo', 'jonkoping-lan', { filterCity: 'Värnamo' }),
  city('se', 'vaxjo', 'Växjö', 'kronoberg', { filterCity: 'Växjö' }),
  city('se', 'ljungby', 'Ljungby', 'kronoberg'),
  city('se', 'kalmar', 'Kalmar', 'kalmar-lan'),
  city('se', 'vastervik', 'Västervik', 'kalmar-lan', { filterCity: 'Västervik' }),
  city('se', 'visby', 'Visby', 'gotland'),
  city('se', 'karlskrona', 'Karlskrona', 'blekinge'),
  city('se', 'karlshamn', 'Karlshamn', 'blekinge'),
  city('se', 'ronneby', 'Ronneby', 'blekinge'),
  city('se', 'solvesborg', 'Sölvesborg', 'blekinge', { filterCity: 'Sölvesborg' }),
  city('se', 'malmo', 'Malmö', 'skane', { filterCity: 'Malmö', nameLocal: 'Malmö' }),
  city('se', 'lund', 'Lund', 'skane'),
  city('se', 'helsingborg', 'Helsingborg', 'skane'),
  city('se', 'kristianstad', 'Kristianstad', 'skane'),
  city('se', 'ystad', 'Ystad', 'skane'),
  city('se', 'trelleborg', 'Trelleborg', 'skane'),
  city('se', 'landskrona', 'Landskrona', 'skane'),
  city('se', 'halmstad', 'Halmstad', 'halland'),
  city('se', 'varberg', 'Varberg', 'halland'),
  city('se', 'falkenberg', 'Falkenberg', 'halland'),
  city('se', 'kungsbacka', 'Kungsbacka', 'halland'),
  city('se', 'goteborg', 'Göteborg', 'vastra-gotaland', {
    filterCity: 'Göteborg',
    nameLocal: 'Göteborg',
  }),
  city('se', 'boras', 'Borås', 'vastra-gotaland', { filterCity: 'Borås' }),
  city('se', 'trollhattan', 'Trollhättan', 'vastra-gotaland', { filterCity: 'Trollhättan' }),
  city('se', 'uddevalla', 'Uddevalla', 'vastra-gotaland'),
  city('se', 'skovde', 'Skövde', 'vastra-gotaland', { filterCity: 'Skövde' }),
  city('se', 'karlstad', 'Karlstad', 'varmland'),
  city('se', 'arvika', 'Arvika', 'varmland'),
  city('se', 'kristinehamn', 'Kristinehamn', 'varmland'),
  city('se', 'orebro', 'Örebro', 'orebro-lan', { filterCity: 'Örebro' }),
  city('se', 'vasteras', 'Västerås', 'vastmanland', { filterCity: 'Västerås' }),
  city('se', 'falun', 'Falun', 'dalarna'),
  city('se', 'borlange', 'Borlänge', 'dalarna', { filterCity: 'Borlänge' }),
  city('se', 'gavle', 'Gävle', 'gavleborg', { filterCity: 'Gävle' }),
  city('se', 'sandviken', 'Sandviken', 'gavleborg'),
  city('se', 'hudiksvall', 'Hudiksvall', 'gavleborg'),
  city('se', 'sundsvall', 'Sundsvall', 'vasternorrland'),
  city('se', 'ornskoldsvik', 'Örnsköldsvik', 'vasternorrland', { filterCity: 'Örnsköldsvik' }),
  city('se', 'harnosand', 'Härnösand', 'vasternorrland', { filterCity: 'Härnösand' }),
  city('se', 'ostersund', 'Östersund', 'jamtland', { filterCity: 'Östersund' }),
  city('se', 'umea', 'Umeå', 'vasterbotten', { filterCity: 'Umeå' }),
  city('se', 'skelleftea', 'Skellefteå', 'vasterbotten', { filterCity: 'Skellefteå' }),
  city('se', 'lulea', 'Luleå', 'norrbotten', { filterCity: 'Luleå' }),
  city('se', 'pitea', 'Piteå', 'norrbotten', { filterCity: 'Piteå' }),
  city('se', 'kiruna', 'Kiruna', 'norrbotten'),
];

const NO_REGIONS: NordicLocation[] = [
  region('no', 'oslo-region', 'Oslo region', { nameLocal: 'Oslo-regionen' }),
  region('no', 'vestland', 'Vestland'),
  region('no', 'trondelag', 'Trøndelag', { nameLocal: 'Trøndelag' }),
  region('no', 'rogaland', 'Rogaland'),
  region('no', 'agder', 'Agder'),
  region('no', 'innlandet', 'Innlandet'),
  region('no', 'viken', 'Eastern Norway', { nameLocal: 'Østlandet' }),
  region('no', 'nord-norge', 'Northern Norway', { nameLocal: 'Nord-Norge' }),
];

const NO_CITIES: NordicLocation[] = [
  city('no', 'oslo', 'Oslo', 'oslo-region'),
  city('no', 'bergen', 'Bergen', 'vestland'),
  city('no', 'trondheim', 'Trondheim', 'trondelag'),
  city('no', 'stavanger', 'Stavanger', 'rogaland'),
  city('no', 'drammen', 'Drammen', 'viken'),
  city('no', 'fredrikstad', 'Fredrikstad', 'viken'),
  city('no', 'kristiansand', 'Kristiansand', 'agder'),
  city('no', 'sandnes', 'Sandnes', 'rogaland'),
  city('no', 'tromso', 'Tromsø', 'nord-norge', { nameLocal: 'Tromsø' }),
  city('no', 'alesund', 'Ålesund', 'vestland', { nameLocal: 'Ålesund' }),
];

const DK_REGIONS: NordicLocation[] = [
  region('dk', 'hovedstaden', 'Capital Region', { nameLocal: 'Region Hovedstaden' }),
  region('dk', 'midtjylland', 'Central Denmark', { nameLocal: 'Region Midtjylland' }),
  region('dk', 'syddanmark', 'Southern Denmark', { nameLocal: 'Region Syddanmark' }),
  region('dk', 'nordjylland', 'North Denmark', { nameLocal: 'Region Nordjylland' }),
  region('dk', 'sjaelland', 'Zealand', { nameLocal: 'Region Sjælland' }),
];

const DK_CITIES: NordicLocation[] = [
  city('dk', 'copenhagen', 'Copenhagen', 'hovedstaden', { nameLocal: 'København' }),
  city('dk', 'aarhus', 'Aarhus', 'midtjylland'),
  city('dk', 'odense', 'Odense', 'syddanmark'),
  city('dk', 'aalborg', 'Aalborg', 'nordjylland'),
  city('dk', 'esbjerg', 'Esbjerg', 'syddanmark'),
  city('dk', 'randers', 'Randers', 'midtjylland'),
  city('dk', 'kolding', 'Kolding', 'syddanmark'),
  city('dk', 'horsens', 'Horsens', 'midtjylland'),
  city('dk', 'vejle', 'Vejle', 'syddanmark'),
  city('dk', 'roskilde', 'Roskilde', 'sjaelland'),
];

const FI_REGIONS: NordicLocation[] = [
  region('fi', 'uusimaa', 'Uusimaa', { nameLocal: 'Uusimaa' }),
  region('fi', 'pirkanmaa', 'Pirkanmaa'),
  region('fi', 'varsinais-suomi', 'Southwest Finland', { nameLocal: 'Varsinais-Suomi' }),
  region('fi', 'pohjois-pohjanmaa', 'North Ostrobothnia', { nameLocal: 'Pohjois-Pohjanmaa' }),
  region('fi', 'keski-suomi', 'Central Finland', { nameLocal: 'Keski-Suomi' }),
];

const FI_CITIES: NordicLocation[] = [
  city('fi', 'helsinki', 'Helsinki', 'uusimaa'),
  city('fi', 'espoo', 'Espoo', 'uusimaa'),
  city('fi', 'tampere', 'Tampere', 'pirkanmaa'),
  city('fi', 'vantaa', 'Vantaa', 'uusimaa'),
  city('fi', 'turku', 'Turku', 'varsinais-suomi', { nameLocal: 'Turku / Åbo' }),
  city('fi', 'oulu', 'Oulu', 'pohjois-pohjanmaa'),
  city('fi', 'jyvaskyla', 'Jyväskylä', 'keski-suomi', { nameLocal: 'Jyväskylä' }),
  city('fi', 'kuopio', 'Kuopio', 'keski-suomi'),
  city('fi', 'lahti', 'Lahti', 'uusimaa'),
];

const IS_REGIONS: NordicLocation[] = [
  region('is', 'hofudborgarsvaedi', 'Capital Region', { nameLocal: 'Höfuðborgarsvæðið' }),
  region('is', 'nordurland', 'North Iceland', { nameLocal: 'Norðurland' }),
  region('is', 'sudurland', 'South Iceland', { nameLocal: 'Suðurland' }),
];

const IS_CITIES: NordicLocation[] = [
  city('is', 'reykjavik', 'Reykjavík', 'hofudborgarsvaedi', { nameLocal: 'Reykjavík' }),
  city('is', 'kopavogur', 'Kópavogur', 'hofudborgarsvaedi', { nameLocal: 'Kópavogur' }),
  city('is', 'akureyri', 'Akureyri', 'nordurland'),
  city('is', 'selfoss', 'Selfoss', 'sudurland'),
];

export const NORDIC_LOCATIONS: readonly NordicLocation[] = [
  ...SE_REGIONS,
  ...SE_CITIES,
  ...NO_REGIONS,
  ...NO_CITIES,
  ...DK_REGIONS,
  ...DK_CITIES,
  ...FI_REGIONS,
  ...FI_CITIES,
  ...IS_REGIONS,
  ...IS_CITIES,
];

const byKey = new Map<string, NordicLocation>();
for (const loc of NORDIC_LOCATIONS) {
  const key = `${loc.country}/${loc.slug}`;
  if (byKey.has(key)) {
    throw new Error(`Duplicate Nordic location: ${key}`);
  }
  byKey.set(key, loc);
}

/** Legacy `/instructors/{slug}` city landings → Nordic SE cities. */
export const LEGACY_INSTRUCTOR_CITY_REDIRECTS = {
  stockholm: '/locations/se/stockholm',
  goteborg: '/locations/se/goteborg',
  malmo: '/locations/se/malmo',
  uppsala: '/locations/se/uppsala',
  vasteras: '/locations/se/vasteras',
} as const;

export function isNordicCountry(value: string): value is NordicCountryCode {
  return (NORDIC_COUNTRIES as readonly string[]).includes(value);
}

export function locationPath(loc: Pick<NordicLocation, 'country' | 'slug'>): string {
  return `/locations/${loc.country}/${loc.slug}`;
}

export function countryPath(code: NordicCountryCode): string {
  return `/locations/${code}`;
}

export function getLocation(country: string, slug: string): NordicLocation | null {
  if (!isNordicCountry(country)) return null;
  return byKey.get(`${country}/${slug}`) ?? null;
}

export function listLocationsForCountry(country: NordicCountryCode): NordicLocation[] {
  return NORDIC_LOCATIONS.filter((l) => l.country === country);
}

export function listCitiesInRegion(
  country: NordicCountryCode,
  regionSlug: string,
): NordicLocation[] {
  return NORDIC_LOCATIONS.filter(
    (l) => l.country === country && l.kind === 'city' && l.regionSlug === regionSlug,
  );
}

export function listRegions(country: NordicCountryCode): NordicLocation[] {
  return NORDIC_LOCATIONS.filter((l) => l.country === country && l.kind === 'region');
}

export function displayName(loc: NordicLocation): string {
  return loc.nameLocal ?? loc.name;
}

export function allLocationSitemapPaths(): string[] {
  const paths = ['/locations'];
  for (const code of NORDIC_COUNTRIES) {
    paths.push(countryPath(code));
  }
  for (const loc of NORDIC_LOCATIONS) {
    paths.push(locationPath(loc));
  }
  return paths;
}
