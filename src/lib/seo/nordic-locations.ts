/**
 * Scalable Nordic location registry for SEO hubs.
 * Add a city/region by appending a row — copy is templated (messages.locationHub).
 *
 * Marketplace booking remains Sweden-first (ADR-001): `marketplaceLive` is true
 * only for SE locations that can filter the live directory.
 */

export const NORDIC_COUNTRIES = [
  'se',
  'no',
  'dk',
  'fi',
  'is',
  'au',
  'gb',
  'es',
  'fr',
  'de',
  'it',
  'pl',
  'at',
  'be',
  'nl',
  'pt',
  'ie',
  'lu',
  'ch',
  'cz',
  'sk',
  'hu',
  'ro',
  'bg',
  'hr',
  'si',
  'gr',
  'cy',
  'mt',
  'ee',
  'lv',
  'lt',
] as const;
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
  au: { code: 'au', name: 'Australia', nameLocal: 'Australia', adjective: 'Australian' },
  gb: { code: 'gb', name: 'United Kingdom', nameLocal: 'United Kingdom', adjective: 'British' },
  es: { code: 'es', name: 'Spain', nameLocal: 'España', adjective: 'Spanish' },
  fr: { code: 'fr', name: 'France', nameLocal: 'France', adjective: 'French' },
  de: { code: 'de', name: 'Germany', nameLocal: 'Deutschland', adjective: 'German' },
  it: { code: 'it', name: 'Italy', nameLocal: 'Italia', adjective: 'Italian' },
  pl: { code: 'pl', name: 'Poland', nameLocal: 'Polska', adjective: 'Polish' },
  at: { code: 'at', name: 'Austria', nameLocal: 'Österreich', adjective: 'Austrian' },
  be: { code: 'be', name: 'Belgium', nameLocal: 'België', adjective: 'Belgian' },
  nl: { code: 'nl', name: 'Netherlands', nameLocal: 'Nederland', adjective: 'Dutch' },
  pt: { code: 'pt', name: 'Portugal', nameLocal: 'Portugal', adjective: 'Portuguese' },
  ie: { code: 'ie', name: 'Ireland', nameLocal: 'Ireland', adjective: 'Irish' },
  lu: { code: 'lu', name: 'Luxembourg', nameLocal: 'Luxembourg', adjective: 'Luxembourgish' },
  ch: { code: 'ch', name: 'Switzerland', nameLocal: 'Schweiz', adjective: 'Swiss' },
  cz: { code: 'cz', name: 'Czechia', nameLocal: 'Česko', adjective: 'Czech' },
  sk: { code: 'sk', name: 'Slovakia', nameLocal: 'Slovensko', adjective: 'Slovak' },
  hu: { code: 'hu', name: 'Hungary', nameLocal: 'Magyarország', adjective: 'Hungarian' },
  ro: { code: 'ro', name: 'Romania', nameLocal: 'România', adjective: 'Romanian' },
  bg: { code: 'bg', name: 'Bulgaria', nameLocal: 'България', adjective: 'Bulgarian' },
  hr: { code: 'hr', name: 'Croatia', nameLocal: 'Hrvatska', adjective: 'Croatian' },
  si: { code: 'si', name: 'Slovenia', nameLocal: 'Slovenija', adjective: 'Slovenian' },
  gr: { code: 'gr', name: 'Greece', nameLocal: 'Ελλάδα', adjective: 'Greek' },
  cy: { code: 'cy', name: 'Cyprus', nameLocal: 'Κύπρος', adjective: 'Cypriot' },
  mt: { code: 'mt', name: 'Malta', nameLocal: 'Malta', adjective: 'Maltese' },
  ee: { code: 'ee', name: 'Estonia', nameLocal: 'Eesti', adjective: 'Estonian' },
  lv: { code: 'lv', name: 'Latvia', nameLocal: 'Latvija', adjective: 'Latvian' },
  lt: { code: 'lt', name: 'Lithuania', nameLocal: 'Lietuva', adjective: 'Lithuanian' },
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

const AU_REGIONS: NordicLocation[] = [
  region('au', 'new-south-wales', 'New South Wales'),
  region('au', 'victoria', 'Victoria'),
  region('au', 'queensland', 'Queensland'),
  region('au', 'western-australia', 'Western Australia'),
  region('au', 'south-australia', 'South Australia'),
  region('au', 'tasmania', 'Tasmania'),
];

const AU_CITIES: NordicLocation[] = [
  city('au', 'sydney', 'Sydney', 'new-south-wales'),
  city('au', 'melbourne', 'Melbourne', 'victoria'),
  city('au', 'brisbane', 'Brisbane', 'queensland'),
  city('au', 'gold-coast', 'Gold Coast', 'queensland'),
  city('au', 'toowoomba', 'Toowoomba', 'queensland'),
  city('au', 'perth', 'Perth', 'western-australia'),
  city('au', 'adelaide', 'Adelaide', 'south-australia'),
  city('au', 'hobart', 'Hobart', 'tasmania'),
];

const GB_REGIONS: NordicLocation[] = [
  region('gb', 'england', 'England'),
  region('gb', 'scotland', 'Scotland'),
  region('gb', 'wales', 'Wales'),
];

const GB_CITIES: NordicLocation[] = [
  city('gb', 'london', 'London', 'england'),
  city('gb', 'manchester', 'Manchester', 'england'),
  city('gb', 'birmingham', 'Birmingham', 'england'),
  city('gb', 'leeds', 'Leeds', 'england'),
  city('gb', 'glasgow', 'Glasgow', 'scotland'),
  city('gb', 'cardiff', 'Cardiff', 'wales'),
];

const EU_PLACES: ReadonlyArray<readonly [NordicCountryCode, string, string, string, string]> = [
  ['es', 'spain', 'Spain', 'madrid', 'Madrid'],
  ['fr', 'france', 'France', 'paris', 'Paris'],
  ['de', 'germany', 'Germany', 'berlin', 'Berlin'],
  ['it', 'italy', 'Italy', 'roma', 'Roma'],
  ['pl', 'poland', 'Poland', 'warszawa', 'Warszawa'],
  ['at', 'austria', 'Austria', 'wien', 'Wien'],
  ['be', 'belgium', 'Belgium', 'bruxelles', 'Bruxelles'],
  ['nl', 'netherlands', 'Netherlands', 'amsterdam', 'Amsterdam'],
  ['pt', 'portugal', 'Portugal', 'lisboa', 'Lisboa'],
  ['ie', 'ireland', 'Ireland', 'dublin', 'Dublin'],
  ['lu', 'luxembourg', 'Luxembourg', 'luxembourg-city', 'Luxembourg'],
  ['ch', 'switzerland', 'Switzerland', 'zuerich', 'Zürich'],
  ['cz', 'czechia', 'Czechia', 'praha', 'Praha'],
  ['sk', 'slovakia', 'Slovakia', 'bratislava', 'Bratislava'],
  ['hu', 'hungary', 'Hungary', 'budapest', 'Budapest'],
  ['ro', 'romania', 'Romania', 'bucuresti', 'București'],
  ['bg', 'bulgaria', 'Bulgaria', 'sofia', 'София'],
  ['hr', 'croatia', 'Croatia', 'zagreb', 'Zagreb'],
  ['si', 'slovenia', 'Slovenia', 'ljubljana', 'Ljubljana'],
  ['gr', 'greece', 'Greece', 'athina', 'Αθήνα'],
  ['cy', 'cyprus', 'Cyprus', 'nicosia', 'Λευκωσία'],
  ['mt', 'malta', 'Malta', 'valletta', 'Valletta'],
  ['ee', 'estonia', 'Estonia', 'tallinn', 'Tallinn'],
  ['lv', 'latvia', 'Latvia', 'riga', 'Rīga'],
  ['lt', 'lithuania', 'Lithuania', 'vilnius', 'Vilnius'],
];

const EU_REGIONS: NordicLocation[] = EU_PLACES.map(([country, slug, name]) =>
  region(country, slug, name),
);
const EU_CITIES: NordicLocation[] = [
  ...EU_PLACES.map(([country, regionSlug, , citySlug, capital]) =>
    city(country, citySlug, capital, regionSlug),
  ),
  city('be', 'liege', 'Liège', 'belgium'),
  city('be', 'namur', 'Namur', 'belgium'),
  city('es', 'langreo-llangreu', 'Langreo / Llangréu', 'spain'),
  city('es', 'oviedo', 'Oviedo', 'spain'),
  city('es', 'carbajosa-de-la-sagrada', 'Carbajosa de la Sagrada', 'spain'),
  city('fr', 'hericourt', 'Hericourt', 'france'),
  city('fr', 'bourges', 'Bourges', 'france'),
  city('fr', 'nemours', 'Nemours', 'france'),
  city('fr', 'coulommiers', 'Coulommiers', 'france'),
  city('fr', 'mirande', 'Mirande', 'france'),
  city('fr', 'dinan', 'Dinan', 'france'),
  city('fr', 'montgermont', 'Montgermont', 'france'),
  city('fr', 'argentre-du-plessis', 'Argentre-Du-Plessis', 'france'),
  city('fr', 'vimoutiers', 'Vimoutiers', 'france'),
  city('fr', 'mondeville', 'Mondeville', 'france'),
  city('fr', 'figeac', 'Figeac', 'france'),
  city('fr', 'giberville', 'Giberville', 'france'),
  city('fr', 'saint-esteve', 'Saint-Esteve', 'france'),
  city('fr', 'baie-mahault', 'Baie-Mahault', 'france'),
  city('fr', 'saint-brieuc', 'Saint-Brieuc', 'france'),
  city('fr', 'montaigu', 'Montaigu', 'france'),
  city('fr', 'carcassonne', 'Carcassonne', 'france'),
  city('fr', 'redon', 'Redon', 'france'),
  city('fr', 'auch', 'Auch', 'france'),
  city('fr', 'bouillargues', 'Bouillargues', 'france'),
  city('fr', 'les-abymes', 'Les Abymes', 'france'),
  city('fr', 'villeneuve-d-ascq', 'Villeneuve-D\'Ascq', 'france'),
  city('fr', 'roubaix', 'Roubaix', 'france'),
  city('fr', 'lagny-sur-marne', 'Lagny-Sur-Marne', 'france'),
  city('fr', 'bon-encontre', 'Bon-Encontre', 'france'),
  city('fr', 'torvilliers', 'Torvilliers', 'france'),
  city('fr', 'corps-nuds', 'Corps-Nuds', 'france'),
  city('fr', 'cantin', 'Cantin', 'france'),
  city('fr', 'saint-amand-montrond', 'Saint-Amand-Montrond', 'france'),
  city('fr', 'lesigny', 'Lesigny', 'france'),
  city('fr', 'nangis', 'Nangis', 'france'),
  city('fr', 'gretz-armainvilliers', 'Gretz-Armainvilliers', 'france'),
  city('fr', 'orange', 'Orange', 'france'),
  city('fr', 'arles', 'Arles', 'france'),
  city('fr', 'caulnes', 'Caulnes', 'france'),
  city('fr', 'mamoudzou', 'Mamoudzou', 'france'),
  city('fr', 'rohrbach-les-bitche', 'Rohrbach-Les-Bitche', 'france'),
  city('fr', 'lormont', 'Lormont', 'france'),
  city('fr', 'brest', 'Brest', 'france'),
  city('fr', 'la-rochelle', 'La Rochelle', 'france'),
  city('fr', 'notre-dame-d-oe', 'Notre-Dame-d\'Oé', 'france'),
  city('de', 'leonberg', 'Leonberg', 'germany'),
  city('de', 'neuss', 'Neuss', 'germany'),
  city('de', 'neu-ulm', 'Neu-Ulm', 'germany'),
  city('de', 'stetten-am-kalten-markt', 'Stetten am kalten Markt', 'germany'),
  city('de', 'lohmar', 'Lohmar', 'germany'),
  city('de', 'nauheim', 'Nauheim', 'germany'),
  city('de', 'ludwigshafen-am-rhein', 'Ludwigshafen am Rhein', 'germany'),
  city('de', 'lohr-am-main', 'Lohr am Main', 'germany'),
  city('de', 'limburg-an-der-lahn', 'Limburg an der Lahn', 'germany'),
  city('de', 'koln', 'Köln', 'germany'),
  city('de', 'spraitbach', 'Spraitbach', 'germany'),
  city('de', 'nurtingen', 'Nürtingen', 'germany'),
  city('de', 'bretten', 'Bretten', 'germany'),
  city('de', 'stuttgart', 'Stuttgart', 'germany'),
  city('de', 'dillenburg', 'Dillenburg', 'germany'),
  city('de', 'karlsruhe', 'Karlsruhe', 'germany'),
  city('de', 'bad-durkheim', 'Bad Dürkheim', 'germany'),
  city('de', 'schmallenberg', 'Schmallenberg', 'germany'),
  city('de', 'mechernich', 'Mechernich', 'germany'),
  city('de', 'bad-wimpfen', 'Bad Wimpfen', 'germany'),
  city('de', 'kreuztal', 'Kreuztal', 'germany'),
  city('de', 'iphofen', 'Iphofen', 'germany'),
  city('de', 'monheim-am-rhein', 'Monheim am Rhein', 'germany'),
  city('de', 'bruhl', 'Brühl', 'germany'),
  city('de', 'mutterstadt', 'Mutterstadt', 'germany'),
  city('de', 'ludwigsburg', 'Ludwigsburg', 'germany'),
  city('de', 'russelsheim-am-main', 'Rüsselsheim am Main', 'germany'),
  city('de', 'fulda', 'Fulda', 'germany'),
  city('de', 'langenfeld-rheinland', 'Langenfeld (Rheinland)', 'germany'),
  city('de', 'ehingen-donau', 'Ehingen (Donau)', 'germany'),
  city('de', 'herborn', 'Herborn', 'germany'),
  city('de', 'freudenberg', 'Freudenberg', 'germany'),
  city('de', 'ottersweier', 'Ottersweier', 'germany'),
  city('de', 'ravensburg', 'Ravensburg', 'germany'),
  city('de', 'siegen', 'Siegen', 'germany'),
  city('de', 'schwabisch-gmund', 'Schwäbisch Gmünd', 'germany'),
  city('de', 'pforzheim', 'Pforzheim', 'germany'),
  city('de', 'zerf', 'Zerf', 'germany'),
  city('de', 'bad-aibling', 'Bad Aibling', 'germany'),
  city('de', 'dresden', 'Dresden', 'germany'),
  city('de', 'landshut', 'Landshut', 'germany'),
  city('de', 'ansbach', 'Ansbach', 'germany'),
  city('de', 'erding', 'Erding', 'germany'),
  city('cz', 'praha-10', 'Praha 10', 'czechia'),
  city('de', 'augsburg', 'Augsburg', 'germany'),
  city('de', 'rodewisch', 'Rodewisch', 'germany'),
  city('de', 'passau', 'Passau', 'germany'),
  city('de', 'straubing', 'Straubing', 'germany'),
  city('de', 'burghausen', 'Burghausen', 'germany'),
  city('de', 'siegsdorf', 'Siegsdorf', 'germany'),
  city('de', 'freital', 'Freital', 'germany'),
  city('de', 'bayreuth', 'Bayreuth', 'germany'),
  city('de', 'moosburg-a-d-isar', 'Moosburg a.d. Isar', 'germany'),
  city('de', 'rosenheim', 'Rosenheim', 'germany'),
  city('de', 'dachau', 'Dachau', 'germany'),
  city('de', 'langenneufnach', 'Langenneufnach', 'germany'),
  city('de', 'parsberg', 'Parsberg', 'germany'),
  city('de', 'pfaffenhofen-a-d-ilm', 'Pfaffenhofen a.d. Ilm', 'germany'),
  city('de', 'hersbruck', 'Hersbruck', 'germany'),
  city('de', 'dusseldorf', 'Düsseldorf', 'germany'),
  city('de', 'paderborn', 'Paderborn', 'germany'),
  city('de', 'wuppertal', 'Wuppertal', 'germany'),
  city('de', 'essen', 'Essen', 'germany'),
  city('de', 'bielefeld', 'Bielefeld', 'germany'),
  city('nl', 'nijmegen', 'Nijmegen', 'netherlands'),
  city('de', 'halle-westf', 'Halle (Westf.)', 'germany'),
  city('de', 'rhede', 'Rhede', 'germany'),
  city('de', 'kassel', 'Kassel', 'germany'),
  city('de', 'leer-ostfriesland', 'Leer (Ostfriesland)', 'germany'),
  city('de', 'kronshagen', 'Kronshagen', 'germany'),
  city('de', 'meschede', 'Meschede', 'germany'),
  city('de', 'bochum', 'Bochum', 'germany'),
  city('de', 'hamburg', 'Hamburg', 'germany'),
  city('de', 'essen-oldenburg', 'Essen (Oldenburg)', 'germany'),
  city('de', 'beckum', 'Beckum', 'germany'),
  city('de', 'hude-oldenburg', 'Hude (Oldenburg)', 'germany'),
  city('de', 'nordkirchen', 'Nordkirchen', 'germany'),
  city('de', 'bocholt', 'Bocholt', 'germany'),
  city('de', 'duisburg', 'Duisburg', 'germany'),
  city('de', 'warstein', 'Warstein', 'germany'),
  city('de', 'rieste', 'Rieste', 'germany'),
  city('de', 'rostock', 'Rostock', 'germany'),
  city('de', 'leipzig', 'Leipzig', 'germany'),
  city('de', 'ketzin-havel', 'Ketzin/Havel', 'germany'),
  city('de', 'bitterfeld-wolfen', 'Bitterfeld-Wolfen', 'germany'),
  city('de', 'markkleeberg', 'Markkleeberg', 'germany'),
  city('de', 'haldensleben', 'Haldensleben', 'germany'),
  city('de', 'wolfenbuttel', 'Wolfenbüttel', 'germany'),
  city('de', 'braunschweig', 'Braunschweig', 'germany'),
  city('de', 'lubbenau-spreewald', 'Lübbenau/Spreewald', 'germany'),
  city('de', 'liebenwalde', 'Liebenwalde', 'germany'),
  city('it', 'lavis', 'Lavis', 'italy'),
  city('it', 'trento', 'Trento', 'italy'),
  city('it', 'milano', 'Milano', 'italy'),
  city('it', 'lana', 'Lana', 'italy'),
  city('it', 'tione-di-trento-tn', 'Tione di Trento TN', 'italy'),
  city('it', 'mori-tn', 'Mori TN', 'italy'),
  city('it', 'lomazzo', 'Lomazzo', 'italy'),
  city('it', 'aci-sant-antonio', 'Aci Sant\'Antonio', 'italy'),
  city('it', 'montelupo-fiorentino', 'Montelupo Fiorentino', 'italy'),
  city('it', 'dueville', 'Dueville', 'italy'),
  city('it', 'genova', 'Genova', 'italy'),
  city('pl', 'ruda-slaska', 'Ruda Śląska', 'poland'),
  city('pl', 'radom', 'Radom', 'poland'),
  city('pl', 'lapy', 'Łapy', 'poland'),
  city('pl', 'janow-lubelski', 'Janów Lubelski', 'poland'),
  city('pl', 'katowice', 'Katowice', 'poland'),
  city('pl', 'bialystok', 'Białystok', 'poland'),
  city('pl', 'ostrowiec-swietokrzyski', 'Ostrowiec Świętokrzyski', 'poland'),
  city('pl', 'tychy', 'Tychy', 'poland'),
  city('pl', 'staszow', 'Staszów', 'poland'),
  city('pl', 'tarnowskie-gory', 'Tarnowskie Góry', 'poland'),
  city('pl', 'wagrowiec', 'Wągrowiec', 'poland'),
  city('pl', 'lodz', 'Łódź', 'poland'),
  city('pl', 'koszalin', 'Koszalin', 'poland'),
  city('pl', 'chelm', 'Chełm', 'poland'),
  city('pl', 'brodnica', 'Brodnica', 'poland'),
  city('at', 'gloggnitz', 'Gloggnitz', 'austria'),
  city('at', 'saalfelden-am-steinernen-meer', 'Saalfelden am Steinernen Meer', 'austria'),
  city('at', 'st-johann-in-tirol', 'St. Johann in Tirol', 'austria'),
  city('at', 'hollabrunn', 'Hollabrunn', 'austria'),
  city('at', 'leibnitz', 'Leibnitz', 'austria'),
  city('at', 'braunau-am-inn', 'Braunau am Inn', 'austria'),
  city('at', 'bad-voslau', 'Bad Vöslau', 'austria'),
  city('be', 'asse', 'Asse', 'belgium'),
  city('nl', 'utrecht', 'Utrecht', 'netherlands'),
  city('nl', 'goes', 'Goes', 'netherlands'),
  city('hu', 'szekszard', 'Szekszárd', 'hungary'),
  city('ro', 'sibiu', 'Sibiu', 'romania'),
  city('ro', 'targu-mures', 'Târgu Mureș', 'romania'),
  city('ro', 'iasi', 'Iași', 'romania'),
  city('ee', 'viljandi', 'Viljandi', 'estonia'),
  city('fr', 'fourchambault', 'Fourchambault', 'france'),
  city('fr', 'la-chapelle-saint-luc', 'La Chapelle-Saint-Luc', 'france'),
  city('fr', 'meaux', 'Meaux', 'france'),
  city('fr', 'perpignan', 'Perpignan', 'france'),
  city('fr', 'tremuson', 'Tremuson', 'france'),
  city('fr', 'seclin', 'Seclin', 'france'),
  city('de', 'regensburg', 'Regensburg', 'germany'),
  city('fr', 'rohrbach-les-bitche-2', 'Rohrbach-lès-Bitche', 'france'),
  city('bg', 'varna', 'Варна', 'bulgaria'),
  city('bg', 'vratsa', 'Враца', 'bulgaria'),
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
  ...AU_REGIONS,
  ...AU_CITIES,
  ...GB_REGIONS,
  ...GB_CITIES,
  ...EU_REGIONS,
  ...EU_CITIES,
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

function foldCity(value: string): string {
  return value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();
}

/** Values that should match a directory `city` filter, including slug aliases. */
export function cityFilterCandidates(input: string): string[] {
  const raw = input.trim();
  if (!raw) return [];
  const folded = foldCity(raw);
  const names = new Set<string>([raw]);
  for (const loc of NORDIC_LOCATIONS) {
    if (!loc.marketplaceLive) continue;
    const hay = [loc.slug, loc.name, loc.nameLocal, loc.filterCity].filter(
      (value): value is string => Boolean(value),
    );
    if (!hay.some((value) => foldCity(value) === folded)) continue;
    names.add(loc.name);
    if (loc.filterCity) names.add(loc.filterCity);
  }
  return [...names];
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
