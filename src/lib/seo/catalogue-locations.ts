// City pages for every catalogue city that does not already have a hub.
// A school whose website country code disagrees with the listing country
// (for example a .md site stored under Romania) does not get a city page.

import type { InstructorFilteredItem } from '@/lib/contracts/instructors';
import {
  catalogueCountryCode,
  catalogueRegionSlug,
  listCatalogueSchools,
} from '@/lib/discovery/nordic-catalogue';
import {
  allLocationSitemapPaths,
  getLocation,
  isNordicCountry,
  locationPath,
  NORDIC_LOCATIONS,
  type NordicCountryCode,
  type NordicLocation,
} from '@/lib/seo/nordic-locations';
import { slugifyText } from '@/lib/seo/school-slugs';

function fold(value: string): string {
  return value.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase('sv').trim();
}

function sameCity(a: string, b: string): boolean {
  const left = a.trim();
  const right = b.trim();
  return left === right || (fold(left) !== '' && fold(left) === fold(right));
}

function listingWebsite(school: InstructorFilteredItem): string | null {
  if (school.publishedPrices?.sourceUrl) return school.publishedPrices.sourceUrl;
  if (school.contact?.kind === 'website') return school.contact.href;
  if (school.priceRequest?.kind === 'website') return school.priceRequest.href;
  return null;
}

/** True when the site's country-code domain is a different country. */
export function websiteCountryDisagrees(url: string, country: string): boolean {
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return false;
  }
  const tld = host.split('.').filter(Boolean).at(-1) ?? '';
  // A two-letter suffix is a country. `.eu` is not one country. `.uk` is Britain.
  if (!/^[a-z]{2}$/.test(tld) || tld === 'eu') return false;
  const mapped = tld === 'uk' ? 'gb' : tld;
  return mapped !== country;
}

function soleRegion(country: NordicCountryCode): string | undefined {
  const regions = NORDIC_LOCATIONS.filter(
    (location) => location.country === country && location.kind === 'region',
  );
  return regions.length === 1 ? regions[0]?.slug : undefined;
}

function existingCity(country: NordicCountryCode, city: string): NordicLocation | undefined {
  return NORDIC_LOCATIONS.find(
    (location) =>
      location.country === country &&
      location.kind === 'city' &&
      (sameCity(location.name, city) ||
        (location.nameLocal != null && sameCity(location.nameLocal, city))),
  );
}

function buildCatalogueCities(): {
  generated: NordicLocation[];
  schoolsByKey: Map<string, InstructorFilteredItem[]>;
} {
  const schoolsByKey = new Map<string, InstructorFilteredItem[]>();
  const pending = new Map<
    string,
    {
      country: NordicCountryCode;
      city: string;
      region?: string;
      schools: InstructorFilteredItem[];
    }
  >();

  const add = (location: NordicLocation, school: InstructorFilteredItem) => {
    const key = `${location.country}/${location.slug}`;
    const list = schoolsByKey.get(key);
    if (list) list.push(school);
    else schoolsByKey.set(key, [school]);
  };

  for (const school of listCatalogueSchools()) {
    const country = catalogueCountryCode(school.id);
    if (!country || !isNordicCountry(country)) continue;
    const city = school.city.trim();
    if (!city) continue;
    const website = listingWebsite(school);
    if (website && websiteCountryDisagrees(website, country)) continue;
    const existing = existingCity(country, city);
    if (existing) {
      add(existing, school);
      continue;
    }
    const region = catalogueRegionSlug(school.id) ?? undefined;
    const groupKey = `${country}/${region ?? ''}/${fold(city) || city}`;
    const group = pending.get(groupKey);
    if (group) group.schools.push(school);
    else pending.set(groupKey, { country, city, region, schools: [school] });
  }

  const taken = new Map<NordicCountryCode, Set<string>>();
  for (const location of NORDIC_LOCATIONS) {
    const slugs = taken.get(location.country) ?? new Set<string>();
    slugs.add(location.slug);
    taken.set(location.country, slugs);
  }

  const generated: NordicLocation[] = [];
  const groups = [...pending.values()].sort(
    (a, b) => a.country.localeCompare(b.country) || a.city.localeCompare(b.city, 'sv'),
  );
  for (const group of groups) {
    const base = slugifyText(group.city);
    if (!base) continue;
    const slugs = taken.get(group.country) ?? new Set<string>();
    let slug = base;
    let n = 2;
    while (slugs.has(slug)) {
      slug = `${base}-${n}`;
      n += 1;
    }
    slugs.add(slug);
    taken.set(group.country, slugs);
    const location: NordicLocation = {
      country: group.country,
      kind: 'city',
      slug,
      name: group.city,
      regionSlug: group.region ?? soleRegion(group.country),
      marketplaceLive: false,
    };
    generated.push(location);
    for (const school of group.schools) add(location, school);
  }

  for (const schools of schoolsByKey.values()) {
    schools.sort((a, b) => a.name.localeCompare(b.name, 'sv'));
  }

  return { generated, schoolsByKey };
}

const built = buildCatalogueCities();
const generatedByKey = new Map(
  built.generated.map((location) => [`${location.country}/${location.slug}`, location]),
);
const locationBySchoolId = new Map<string, NordicLocation>();
for (const [key, schools] of built.schoolsByKey) {
  const slash = key.indexOf('/');
  const location = resolveLocation(key.slice(0, slash), key.slice(slash + 1));
  if (!location) continue;
  for (const school of schools) locationBySchoolId.set(school.id, location);
}

export function generatedCatalogueCities(): readonly NordicLocation[] {
  return built.generated;
}

export function resolveLocation(country: string, slug: string): NordicLocation | null {
  if (!isNordicCountry(country)) return null;
  return getLocation(country, slug) ?? generatedByKey.get(`${country}/${slug}`) ?? null;
}

export function locationForCatalogueSchool(id: string): NordicLocation | null {
  return locationBySchoolId.get(id) ?? null;
}

export function locationsForCountry(country: NordicCountryCode): NordicLocation[] {
  return [
    ...NORDIC_LOCATIONS.filter((location) => location.country === country),
    ...built.generated.filter((location) => location.country === country),
  ];
}

export function citiesInRegion(country: NordicCountryCode, regionSlug: string): NordicLocation[] {
  return locationsForCountry(country).filter(
    (location) => location.kind === 'city' && location.regionSlug === regionSlug,
  );
}

const REGION_PAGE_CITY_CAP = 80;

/** Cities linked from a region page. A long country keeps the hand-written hubs. */
export function browseCities(country: NordicCountryCode, regionSlug: string): NordicLocation[] {
  const all = citiesInRegion(country, regionSlug);
  if (all.length <= REGION_PAGE_CITY_CAP) return all;
  const staticSlugs = new Set(
    NORDIC_LOCATIONS.filter(
      (location) =>
        location.country === country &&
        location.kind === 'city' &&
        location.regionSlug === regionSlug,
    ).map((location) => location.slug),
  );
  const featured = all.filter((city) => staticSlugs.has(city.slug));
  if (featured.length > 0) return featured;
  return all.slice(0, REGION_PAGE_CITY_CAP);
}

export function schoolsForLocation(location: NordicLocation): InstructorFilteredItem[] {
  return built.schoolsByKey.get(`${location.country}/${location.slug}`) ?? [];
}

/** A generated city page with fewer schools than this is near-duplicate template text. */
export const MIN_SCHOOLS_FOR_INDEXED_CITY = 3;

/** Hand-written hubs always index; generated city pages need enough schools to stand alone. */
export function isIndexableLocation(location: NordicLocation): boolean {
  if (!generatedByKey.has(`${location.country}/${location.slug}`)) return true;
  return schoolsForLocation(location).length >= MIN_SCHOOLS_FOR_INDEXED_CITY;
}

export function indexableLocationPaths(): string[] {
  return [
    ...allLocationSitemapPaths(),
    ...built.generated.filter(isIndexableLocation).map((location) => locationPath(location)),
  ];
}
