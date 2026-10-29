import { catalogueCountryCode, catalogueRegionSlug } from '@/lib/discovery/nordic-catalogue';

/** Maps Vercel `x-vercel-ip-country` (ISO 3166-1 alpha-2) to catalogue country codes. */
const VISITOR_COUNTRY_TO_CATALOGUE: Record<string, string> = {
  SE: 'se',
  NO: 'no',
  DK: 'dk',
  IS: 'is',
  FI: 'fi',
  US: 'us',
  GB: 'gb',
  AU: 'au',
  DE: 'de',
  FR: 'fr',
  ES: 'es',
  IT: 'it',
  PL: 'pl',
  AT: 'at',
  BE: 'be',
  NL: 'nl',
  PT: 'pt',
  IE: 'ie',
  CH: 'ch',
  CZ: 'cz',
};

/** US state/territory codes from `x-vercel-ip-country-region` → catalogue region slug. */
const US_REGION_TO_SLUG: Record<string, string> = {
  AL: 'alabama',
  AZ: 'arizona',
  AR: 'arkansas',
  CA: 'california',
  CO: 'colorado',
  CT: 'connecticut',
  FL: 'florida',
  GA: 'georgia',
  ID: 'idaho',
  IL: 'illinois',
  IN: 'indiana',
  IA: 'iowa',
  KS: 'kansas',
  KY: 'kentucky',
  LA: 'louisiana',
  MD: 'maryland',
  MA: 'massachusetts',
  MI: 'michigan',
  MN: 'minnesota',
  MO: 'missouri',
  NV: 'nevada',
  NH: 'new-hampshire',
  NJ: 'new-jersey',
  NY: 'new-york',
  NC: 'north-carolina',
  OH: 'ohio',
  OK: 'oklahoma',
  OR: 'oregon',
  PA: 'pennsylvania',
  SC: 'south-carolina',
  TN: 'tennessee',
  TX: 'texas',
  UT: 'utah',
  VA: 'virginia',
  WA: 'washington',
  WI: 'wisconsin',
};

export type VisitorCatalogueRegion = {
  countryCode: string;
  regionSlug: string | null;
};

export function visitorCatalogueRegionFromHeaders(
  getHeader: (name: string) => string | null,
): VisitorCatalogueRegion {
  const countryRaw = getHeader('x-vercel-ip-country')?.trim().toUpperCase() ?? 'SE';
  const countryCode = VISITOR_COUNTRY_TO_CATALOGUE[countryRaw] ?? 'se';

  const regionRaw = getHeader('x-vercel-ip-country-region')?.trim().toUpperCase() ?? '';
  let regionSlug: string | null = null;
  if (countryCode === 'us' && regionRaw) {
    regionSlug = US_REGION_TO_SLUG[regionRaw] ?? null;
  }

  return { countryCode, regionSlug };
}

export function homepageSchoolRegionScore(
  listingId: string,
  region: VisitorCatalogueRegion,
): number {
  const country = catalogueCountryCode(listingId) ?? 'se';
  if (country !== region.countryCode) return 0;
  let score = 10;
  const schoolRegion = catalogueRegionSlug(listingId);
  if (region.regionSlug && schoolRegion === region.regionSlug) score += 5;
  return score;
}
