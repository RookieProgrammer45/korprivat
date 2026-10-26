// marketplace. The hero chip on the landing page, the contract enum, and the
// booking form's `<Select>` all import the same set so display copy and
// validation never drift apart.

export const LICENCE_CATEGORY_CODES = ['AM', 'A1', 'A2', 'A', 'B', 'BE'] as const;

export type LicenceCategoryCode = (typeof LICENCE_CATEGORY_CODES)[number];

export const MOTORCYCLE_LICENCE_CODES = ['A1', 'A2', 'A'] as const;

const CODE_SET: ReadonlySet<string> = new Set(LICENCE_CATEGORY_CODES);
const MOTORCYCLE_SET: ReadonlySet<string> = new Set(MOTORCYCLE_LICENCE_CODES);

export function isLicenceCategoryCode(value: string): value is LicenceCategoryCode {
  return CODE_SET.has(value);
}

/** Swedish B schools usually also teach motorcycle. Read-time only — not a permit. */
export function withUsualMotorcycleCategories(
  categories: readonly string[],
): LicenceCategoryCode[] {
  const present = new Set<LicenceCategoryCode>();
  for (const code of categories) {
    if (isLicenceCategoryCode(code)) present.add(code);
  }
  if (present.has('B')) {
    for (const code of MOTORCYCLE_LICENCE_CODES) present.add(code);
  }
  return LICENCE_CATEGORY_CODES.filter((code) => present.has(code));
}

/** A motorcycle filter must also match stored B-only listings. */
export function categoryFilterMatches(requested: readonly string[]): string[] {
  const next = new Set(requested);
  if (requested.some((code) => MOTORCYCLE_SET.has(code))) next.add('B');
  return [...next];
}
