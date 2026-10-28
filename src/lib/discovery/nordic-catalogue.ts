// Driving schools outside Sweden, collected from each school's own website.
// They are directory entries only: not a verified permit, not a lesson price
// in SEK, and not something DriveLinkUp can book.
import type {
  HeavyFilter,
  HeavyLicenceCode,
  LicenceCategoryCode,
} from '@/lib/business/licence-categories';
import { HEAVY_LICENCE_CODES, LICENCE_CATEGORY_CODES } from '@/lib/business/licence-categories';
import type { InstructorFilteredItem, InstructorQuery } from '@/lib/contracts/instructors';
import { cityFilterCandidates } from '@/lib/seo/nordic-locations';
import { schoolShortId } from '@/lib/seo/school-slugs';
import australia from '../../../data/australia-schools/schools.json';
import europe from '../../../data/europe-schools/schools.json';
import dataset from '../../../data/nordic-schools/schools.json';
import unitedKingdom from '../../../data/uk-schools/schools.json';

const LIGHT = new Set<string>(LICENCE_CATEGORY_CODES);
const PRICE_CAP: Record<string, readonly [number, number]> = {
  NO: [400, 2500],
  DK: [200, 1500],
  IS: [2000, 30000],
  FI: [20, 200],
  AU: [50, 200],
  GB: [20, 80],
  ES: [15, 150],
  FR: [15, 150],
  DE: [15, 150],
  IT: [15, 150],
  AT: [15, 150],
  BE: [15, 150],
  NL: [15, 150],
  PT: [15, 150],
  IE: [15, 150],
  LU: [15, 150],
  SK: [15, 150],
  HR: [15, 150],
  SI: [15, 150],
  GR: [15, 150],
  CY: [15, 150],
  MT: [15, 150],
  EE: [15, 150],
  LV: [15, 150],
  LT: [15, 150],
  PL: [40, 250],
  CH: [40, 200],
  CZ: [300, 1500],
  HU: [4000, 25000],
  RO: [40, 250],
  BG: [20, 120],
};
const COUNTRY_NAME: Record<string, string> = {
  NO: 'Norge',
  DK: 'Danmark',
  FI: 'Finland',
  IS: 'Island',
  AU: 'Australia',
  GB: 'United Kingdom',
  ES: 'Spain',
  FR: 'France',
  DE: 'Germany',
  IT: 'Italy',
  PL: 'Poland',
  AT: 'Austria',
  BE: 'Belgium',
  NL: 'Netherlands',
  PT: 'Portugal',
  IE: 'Ireland',
  LU: 'Luxembourg',
  CH: 'Switzerland',
  CZ: 'Czechia',
  SK: 'Slovakia',
  HU: 'Hungary',
  RO: 'Romania',
  BG: 'Bulgaria',
  HR: 'Croatia',
  SI: 'Slovenia',
  GR: 'Greece',
  CY: 'Cyprus',
  MT: 'Malta',
  EE: 'Estonia',
  LV: 'Latvia',
  LT: 'Lithuania',
};
const LANGUAGE: Record<string, CatalogueLanguage> = {
  NO: 'no',
  DK: 'da',
  FI: 'fi',
  IS: 'is',
  AU: 'en',
  GB: 'en',
  ES: 'es',
  FR: 'fr',
  DE: 'de',
  IT: 'it',
  PL: 'pl',
  AT: 'de',
  BE: 'nl',
  NL: 'nl',
  PT: 'pt',
  IE: 'en',
  LU: 'fr',
  CH: 'de',
  CZ: 'cs',
  SK: 'sk',
  HU: 'hu',
  RO: 'ro',
  BG: 'bg',
  HR: 'hr',
  SI: 'sl',
  GR: 'el',
  CY: 'el',
  MT: 'en',
  EE: 'et',
  LV: 'lv',
  LT: 'lt',
};
const BAD_LOCAL = new Set([
  'bruker',
  'navn',
  'name',
  'example',
  'test',
  'email',
  'mail',
  'user',
  'username',
  'yourname',
  'epost',
  'din-epost',
]);
const BAD_DOMAIN = [
  'domene.no',
  'epost.no',
  'example.com',
  'example.no',
  'example.org',
  'plesk.page',
  'wixpress.com',
  'sentry.io',
  'schema.org',
  'godaddy.com',
  'wordpress.com',
];

type CatalogueLanguage =
  | 'en'
  | 'no'
  | 'da'
  | 'fi'
  | 'is'
  | 'es'
  | 'fr'
  | 'de'
  | 'it'
  | 'pl'
  | 'nl'
  | 'pt'
  | 'cs'
  | 'hu'
  | 'ro'
  | 'bg'
  | 'hr'
  | 'sl'
  | 'sk'
  | 'el'
  | 'et'
  | 'lv'
  | 'lt';
type NordicCountry =
  | 'NO'
  | 'DK'
  | 'FI'
  | 'IS'
  | 'AU'
  | 'GB'
  | 'ES'
  | 'FR'
  | 'DE'
  | 'IT'
  | 'PL'
  | 'AT'
  | 'BE'
  | 'NL'
  | 'PT'
  | 'IE'
  | 'LU'
  | 'CH'
  | 'CZ'
  | 'SK'
  | 'HU'
  | 'RO'
  | 'BG'
  | 'HR'
  | 'SI'
  | 'GR'
  | 'CY'
  | 'MT'
  | 'EE'
  | 'LV'
  | 'LT';
type NordicCurrency =
  | 'NOK'
  | 'DKK'
  | 'EUR'
  | 'ISK'
  | 'AUD'
  | 'GBP'
  | 'PLN'
  | 'CZK'
  | 'HUF'
  | 'RON'
  | 'BGN'
  | 'CHF';

type RawSchool = {
  id: string;
  country: NordicCountry;
  name: string;
  city: string;
  website: string | null;
  categories: string[];
  heavy: string[];
  email: string | null;
  phone: string | null;
  lessonPrice: number | null;
  lessonMinutes: number | null;
  currency: NordicCurrency;
  language?: CatalogueLanguage;
  sourceUrl: string | null;
  checkedAt: string;
  websiteStatus?: string;
};

export type NordicCatalogueQuery = Pick<
  InstructorQuery,
  | 'categories'
  | 'city'
  | 'minRate'
  | 'maxRate'
  | 'minRating'
  | 'availability'
  | 'english'
  | 'nearKm'
  | 'sort'
  | 'heavy'
  | 'providerRole'
  | 'affiliation'
>;

const DIRECTORY_SURFACES = {
  availabilityDisplay: false,
  inquiryCollection: false,
  requestToBook: false,
  transactionalBooking: false,
  directoryOnly: true,
} as const;

function usableWebsite(value: string | null): string | null {
  if (!value || !/^https?:\/\//i.test(value)) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    return url.toString();
  } catch {
    return null;
  }
}

function usableEmail(value: string | null): string | null {
  if (!value) return null;
  const mail = value.trim().toLowerCase();
  const match = mail.match(/^([a-z0-9._%+-]+)@([a-z0-9.-]+\.[a-z]{2,})$/);
  if (!match) return null;
  const local = match[1] ?? '';
  const domain = match[2] ?? '';
  if (BAD_LOCAL.has(local) || local.includes('dintrafikkskole')) return null;
  if (BAD_DOMAIN.some((part) => domain.includes(part))) return null;
  if (/\.(png|jpe?g|webp|gif|svg)$/.test(mail) || /@[0-9]?x[0-9]/.test(mail)) return null;
  return mail;
}

function usablePhone(value: string | null, country: NordicCountry): string | null {
  if (!value) return null;
  const digits = value.replace(/\D/g, '');
  if (country === 'NO' && digits.startsWith('47')) {
    const local = digits.slice(2);
    return local.length === 8 && validLocal(local) ? `+47${local}` : null;
  }
  if (country === 'DK' && digits.startsWith('45')) {
    const local = digits.slice(2);
    return local.length === 8 && validLocal(local) ? `+45${local}` : null;
  }
  if (country === 'IS' && digits.startsWith('354')) {
    const local = digits.slice(3);
    return local.length === 7 && validLocal(local) ? `+354${local}` : null;
  }
  if (country === 'AU') {
    const local = digits.startsWith('61')
      ? digits.slice(2)
      : digits.startsWith('0')
        ? digits.slice(1)
        : '';
    if (local.length !== 9 || !/^[23478]/.test(local) || new Set(local).size < 3) return null;
    return `+61${local}`;
  }
  if (country === 'GB') {
    const local = digits.startsWith('44')
      ? digits.slice(2)
      : digits.startsWith('0')
        ? digits.slice(1)
        : '';
    if (local.length !== 10 || !/^[127]/.test(local) || new Set(local).size < 3) return null;
    return `+44${local}`;
  }
  return null;
}

function validLocal(digits: string): boolean {
  return !digits.startsWith('0') && !digits.startsWith('1') && new Set(digits).size >= 3;
}

function phoneFact(e164: string): { display: string; href: string } {
  if (e164.startsWith('+61')) {
    const body = e164.slice(3);
    const display = body.startsWith('4')
      ? `+61 ${body.slice(0, 3)} ${body.slice(3, 6)} ${body.slice(6)}`
      : `+61 ${body.slice(0, 1)} ${body.slice(1, 5)} ${body.slice(5)}`;
    return { display, href: `tel:${e164}` };
  }
  if (e164.startsWith('+44')) {
    const body = e164.slice(3);
    const display = body.startsWith('7')
      ? `+44 ${body.slice(0, 4)} ${body.slice(4)}`
      : body.startsWith('2')
        ? `+44 20 ${body.slice(2, 6)} ${body.slice(6)}`
        : `+44 ${body.slice(0, 3)} ${body.slice(3, 6)} ${body.slice(6)}`;
    return { display, href: `tel:${e164}` };
  }
  const body = e164.startsWith('+354') ? e164.slice(4) : e164.slice(3);
  const groups = e164.startsWith('+354')
    ? `${body.slice(0, 3)} ${body.slice(3)}`
    : body.replace(/(\d{2})(?=\d)/g, '$1 ').trim();
  const prefix = e164.startsWith('+354') ? '+354' : e164.startsWith('+45') ? '+45' : '+47';
  return { display: `${prefix} ${groups}`, href: `tel:${e164}` };
}

function lessonAmount(school: RawSchool): number | null {
  const amount = school.lessonPrice;
  if (typeof amount !== 'number' || !Number.isInteger(amount)) return null;
  const cap = PRICE_CAP[school.country];
  if (!cap || amount < cap[0] || amount > cap[1]) return null;
  return amount;
}

function lightCategories(codes: readonly string[]): LicenceCategoryCode[] {
  return LICENCE_CATEGORY_CODES.filter((code) => codes.includes(code));
}

function heavyCategories(codes: readonly string[]): HeavyLicenceCode[] {
  return HEAVY_LICENCE_CODES.filter((code) => codes.includes(code));
}

export function toNordicInstructor(school: RawSchool): InstructorFilteredItem | null {
  const website = usableWebsite(school.website);
  const categories = lightCategories(school.categories);
  const heavy = heavyCategories(school.heavy);
  const city = school.city?.trim();
  const language = school.language ?? LANGUAGE[school.country];
  const countryName = COUNTRY_NAME[school.country];
  // A truck or bus school can be listed with no car category. The heavy codes
  // stay on publishedPrices and off the car catalogue.
  if (!website || !school.name?.trim() || !city) return null;
  if (categories.length === 0 && heavy.length === 0) return null;
  if (!language || !countryName) return null;
  const amount = lessonAmount(school);
  // Australia is listed only when the school's own page states a lesson price.
  if ((school.country === 'AU' || school.country === 'GB') && amount == null) return null;
  const email = usableEmail(school.email);
  const contact = email
    ? { kind: 'inbox' as const, href: `mailto:${email}` }
    : { kind: 'website' as const, href: website };
  const phone = usablePhone(school.phone, school.country);
  const collectedAt = /^\d{4}-\d{2}-\d{2}$/.test(school.checkedAt)
    ? school.checkedAt
    : '2026-10-28';
  const publishedPrices =
    amount || heavy.length > 0
      ? {
          lesson: amount
            ? {
                priceSek: amount,
                minutes:
                  typeof school.lessonMinutes === 'number' && school.lessonMinutes > 0
                    ? school.lessonMinutes
                    : null,
              }
            : null,
          risk1Sek: null,
          risk2Sek: null,
          packages: [],
          sourceUrl: website,
          collectedAt,
          currency: school.currency,
          heavy:
            heavy.length > 0
              ? {
                  categories: heavy,
                  ykb: false,
                  prices: [],
                  sourceUrl: website,
                  collectedAt,
                }
              : null,
        }
      : null;
  return {
    id: school.id,
    name: school.name.trim(),
    city,
    serviceArea: `${city}, ${countryName}`,
    categories,
    hourlyRateSek: 0,
    bio: 'Kontaktuppgifter och pris kommer från skolans webbplats. DriveLinkUp har inte verifierat tillståndet och bokar inte lektionen.',
    photoUrl: '',
    englishSpeaking: language === 'en',
    languages: [language],
    verificationStatus: 'unverified',
    reviewSummary: { count: 0, averageRating: null },
    nextSlotAt: null,
    cancellationPolicyTier: null,
    showCancellationPolicy: false,
    bookingMode: 'contact',
    surfaces: DIRECTORY_SURFACES,
    canCollectPayment: false,
    providerRole: 'SCHOOL',
    providerType: 'SCHOOL',
    affiliation: null,
    phone: phone ? phoneFact(phone) : null,
    contact,
    priceRequest: amount ? null : contact,
    publishedPrices,
  };
}

function rawSchools(): RawSchool[] {
  return [
    ...(dataset.schools as RawSchool[]),
    ...(australia.schools as RawSchool[]),
    ...(unitedKingdom.schools as RawSchool[]),
    ...(europe.schools as RawSchool[]),
  ];
}

const byId = new Map<string, InstructorFilteredItem>();
const byShortId = new Map<string, InstructorFilteredItem>();
const countryById = new Map<string, string>();
for (const school of rawSchools()) {
  const instructor = toNordicInstructor(school);
  if (!instructor) continue;
  const shortId = schoolShortId(instructor.id);
  if (byId.has(instructor.id) || byShortId.has(shortId)) continue;
  byId.set(instructor.id, instructor);
  byShortId.set(shortId, instructor);
  countryById.set(instructor.id, school.country.toLowerCase());
}

const catalogue = [...byId.values()];

function offersHeavy(school: InstructorFilteredItem, filter: HeavyFilter): boolean {
  const codes = school.publishedPrices?.heavy?.categories ?? [];
  if (filter === 'ykb') return false;
  if (filter === 'all') return codes.length > 0;
  if (filter === 'truck') return codes.some((code) => code.startsWith('C'));
  return codes.some((code) => code.startsWith('D'));
}

export function listNordicInstructors(query: NordicCatalogueQuery): InstructorFilteredItem[] {
  if (
    query.availability ||
    query.nearKm != null ||
    query.minRating != null ||
    query.minRate != null ||
    query.maxRate != null ||
    query.providerRole === 'INSTRUCTOR' ||
    query.affiliation === 'independent'
  ) {
    return [];
  }
  const wanted = query.categories ? new Set<string>(query.categories) : null;
  const cities = query.city
    ? new Set(cityFilterCandidates(query.city).map((city) => city.toLocaleLowerCase('sv')))
    : null;
  return catalogue.filter((school) => {
    if (query.english === true && !school.englishSpeaking) return false;
    if (wanted && !school.categories.some((code) => wanted.has(code))) return false;
    if (cities && !cities.has(school.city.toLocaleLowerCase('sv'))) return false;
    if (query.heavy) return offersHeavy(school, query.heavy);
    return school.categories.some((code) => LIGHT.has(code));
  });
}

export function nordicCatalogueCities(): string[] {
  return [...new Set(catalogue.map((school) => school.city))].sort((a, b) =>
    a.localeCompare(b, 'sv'),
  );
}

export function listCatalogueSchools(): readonly InstructorFilteredItem[] {
  return catalogue;
}

/** ISO-like catalogue country (`de`, `gb`) for a listed school, or null. */
export function catalogueCountryCode(id: string): string | null {
  return countryById.get(id) ?? null;
}

export function nordicInstructorById(id: string): InstructorFilteredItem | null {
  return byId.get(id) ?? null;
}

export function nordicInstructorByShortId(id8: string): InstructorFilteredItem | null {
  return byShortId.get(id8) ?? null;
}

export function nordicListedCount(): number {
  return catalogue.length;
}

function foldCityName(value: string): string {
  return value.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase('sv').trim();
}

export function nordicSchoolCountInCity(city: string): number {
  const wanted = foldCityName(city);
  if (!wanted) return 0;
  return catalogue.filter((school) => foldCityName(school.city) === wanted).length;
}

const COUNTRY_PREFIX = {
  no: 'no',
  dk: 'dk',
  fi: 'fi',
  is: 'is',
  au: 'au',
  gb: 'uk',
  es: 'eues',
  fr: 'eufr',
  de: 'eude',
  it: 'euit',
  pl: 'eupl',
  at: 'euat',
  be: 'eube',
  nl: 'eunl',
  pt: 'eupt',
  ie: 'euie',
  lu: 'eulu',
  ch: 'euch',
  cz: 'eucz',
  sk: 'eusk',
  hu: 'euhu',
  ro: 'euro',
  bg: 'eubg',
  hr: 'euhr',
  si: 'eusi',
  gr: 'eugr',
  cy: 'eucy',
  mt: 'eumt',
  ee: 'euee',
  lv: 'eulv',
  lt: 'eult',
} as const;

export function nordicCountryHasSchools(country: keyof typeof COUNTRY_PREFIX): boolean {
  const prefix = COUNTRY_PREFIX[country];
  return catalogue.some((school) => school.id.startsWith(prefix));
}
