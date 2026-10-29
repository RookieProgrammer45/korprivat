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
