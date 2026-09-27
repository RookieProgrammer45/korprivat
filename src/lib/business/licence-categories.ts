// marketplace. The hero chip on the landing page, the contract enum, and the
// booking form's `<Select>` all import the same set so display copy and
// validation never drift apart.

export const LICENCE_CATEGORY_CODES = ['AM', 'A1', 'A2', 'A', 'B', 'BE'] as const;

export type LicenceCategoryCode = (typeof LICENCE_CATEGORY_CODES)[number];

const CODE_SET: ReadonlySet<string> = new Set(LICENCE_CATEGORY_CODES);

export function isLicenceCategoryCode(value: string): value is LicenceCategoryCode {
  return CODE_SET.has(value);
}
