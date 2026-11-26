import { catalogueCountryCode, catalogueRegionSlug } from '@/lib/discovery/nordic-catalogue';

/** Maps Vercel `x-vercel-ip-country` (ISO 3166-1 alpha-2) to catalogue country codes. */
const VISITOR_COUNTRY_TO_CATALOGUE: Record<string, string> = {
  SE: 'se',
  NO: 'no',
  DK: 'dk',
  IS: 'is',
  FI: 'fi',
  US: 'us',
  CA: 'ca',
  BR: 'br',
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

/** Canadian province codes from `x-vercel-ip-country-region` → catalogue region slug. */
const CA_REGION_TO_SLUG: Record<string, string> = {
  AB: 'alberta',
  BC: 'british-columbia',
  MB: 'manitoba',
  NB: 'new-brunswick',
  NL: 'newfoundland-and-labrador',
  NS: 'nova-scotia',
  ON: 'ontario',
  PE: 'prince-edward-island',
  QC: 'quebec',
  SK: 'saskatchewan',
  NT: 'northwest-territories',
  NU: 'nunavut',
  YT: 'yukon',
};

/** Brazilian state codes from `x-vercel-ip-country-region` → catalogue region slug. */
const BR_REGION_TO_SLUG: Record<string, string> = {
  AC: 'acre',
  AL: 'alagoas',
  AP: 'amapa',
  AM: 'amazonas',
  BA: 'bahia',
  CE: 'ceara',
  DF: 'distrito-federal',
  ES: 'espirito-santo',
  GO: 'goias',
  MA: 'maranhao',
  MT: 'mato-grosso',
  MS: 'mato-grosso-do-sul',
  MG: 'minas-gerais',
  PA: 'para',
  PB: 'paraiba',
  PR: 'parana',
  PE: 'pernambuco',
  PI: 'piaui',
  RJ: 'rio-de-janeiro',
  RN: 'rio-grande-do-norte',
  RS: 'rio-grande-do-sul',
  RO: 'rondonia',
  RR: 'roraima',
  SC: 'santa-catarina',
  SP: 'sao-paulo',
  SE: 'sergipe',
  TO: 'tocantins',
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
  } else if (countryCode === 'ca' && regionRaw) {
    regionSlug = CA_REGION_TO_SLUG[regionRaw] ?? null;
  } else if (countryCode === 'br' && regionRaw) {
    regionSlug = BR_REGION_TO_SLUG[regionRaw] ?? null;
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
