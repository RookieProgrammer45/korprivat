// Published logos identify the business. They are the mark from the business's
// own site, shown only as identification — never as a DriveLinkUp endorsement.

const HTTP_URL = /^https?:\/\/[^\s]+$/i;

/** A stored http(s) image, including a scraped logo or SVG mark. */
export function schoolPortraitUrl(url: string | null | undefined): string | null {
  const raw = (url ?? '').trim();
  if (!HTTP_URL.test(raw)) return null;
  return raw;
}

export function schoolInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean).slice(0, 2);
  return parts
    .map((part) => part[0] ?? '')
    .join('')
    .toUpperCase();
}

export type SchoolMarkSymbol = 'light' | 'heavy' | 'initials';

export type SchoolHeavyAdvertised = {
  categories: readonly string[];
  ykb?: boolean | null;
};

function schoolAdvertisesHeavy(heavy: SchoolHeavyAdvertised | null | undefined): boolean {
  if (!heavy) return false;
  return heavy.categories.length > 0 || heavy.ykb === true;
}

/** Car vs truck vs initials for schools without a portrait photo. */
export function schoolMarkSymbol(
  categories: readonly string[],
  heavy: SchoolHeavyAdvertised | null | undefined,
  options?: { heavyScope?: boolean },
): SchoolMarkSymbol {
  const hasLight = categories.length > 0;
  const hasHeavy = schoolAdvertisesHeavy(heavy);

  if (options?.heavyScope && hasHeavy) return 'heavy';
  if (hasLight) return 'light';
  if (hasHeavy) return 'heavy';
  return 'initials';
}

/** @deprecated Use schoolMarkSymbol — kept for tests that assert light-only detection. */
export function schoolShowsLightVehicleMark(categories: readonly string[]): boolean {
  return categories.length > 0;
}
