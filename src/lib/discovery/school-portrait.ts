// School trade marks and website logos are third-party IP. The directory uses
// initials only — never hotlink or cache a school's logo from its website.

const LOGO_IN_PATH =
  /\b(logo|logotyp|logga|favicon|sprite|brand-mark|site-icon)\b|\/og-\d|partner.*\/assets\//i;

/** Whether a stored URL is shown as a school portrait (not a logo or placeholder). */
export function schoolPortraitUrl(url: string | null | undefined): string | null {
  const raw = (url ?? '').trim();
  if (!raw) return null;
  const path = raw.split('?')[0]?.toLowerCase() ?? '';
  if (path.endsWith('.svg')) return null;
  if (LOGO_IN_PATH.test(path)) return null;
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
