// marketplace. The hero chip on the landing page, the contract enum, and the
// booking form's `<Select>` all import the same set so display copy and
// validation never drift apart.

export const LICENCE_CATEGORY_CODES = ['AM', 'A1', 'A2', 'A', 'B', 'BE'] as const;

export type LicenceCategoryCode = (typeof LICENCE_CATEGORY_CODES)[number];

// Heavy-vehicle categories come from each school's website (data/school-prices),
// not from the listing's permit categories, so they stay out of the booking enum.
export const HEAVY_LICENCE_CODES = ['C1', 'C1E', 'C', 'CE', 'D1', 'D1E', 'D', 'DE'] as const;

export type HeavyLicenceCode = (typeof HEAVY_LICENCE_CODES)[number];

/** Directory filter: truck = C1/C1E/C/CE, bus = D1/D1E/D/DE, ykb = YKB courses. */
export const HEAVY_FILTERS = ['all', 'truck', 'bus', 'ykb'] as const;

export type HeavyFilter = (typeof HEAVY_FILTERS)[number];

const CODE_SET: ReadonlySet<string> = new Set(LICENCE_CATEGORY_CODES);

export function isLicenceCategoryCode(value: string): value is LicenceCategoryCode {
  return CODE_SET.has(value);
}

// Stored permit categories only. Car training is not evidence of motorcycle,
// taxi, or heavy-vehicle training.
export function withUsualMotorcycleCategories(
  categories: readonly string[],
): LicenceCategoryCode[] {
  const present = new Set<LicenceCategoryCode>();
  for (const code of categories) {
    if (isLicenceCategoryCode(code)) present.add(code);
  }
  return LICENCE_CATEGORY_CODES.filter((code) => present.has(code));
}

export function categoryFilterMatches(requested: readonly string[]): string[] {
  return [...new Set(requested)];
}
