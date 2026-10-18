//
// Slug helpers for the crawlable school detail URLs.
//
// URL scheme: /trafikskola/<stad>/<skolnamn>-<id8>
//   - city + name give search engines (and humans) readable, keyword-rich URLs
//     instead of opaque /instructors/<uuid> paths
//   - the trailing 8-char id makes every URL collision-free and stable even if
//     two schools share a name in the same city - no DB slug column needed
//   - legacy /instructors/<uuid> URLs permanently (308) redirect to this
//     canonical form, so existing links and indexed pages keep working
//

export type SchoolPathSource = {
  id: string;
  name: string;
  city: string;
};

/** Lowercase, ASCII-only, dash-separated slug ("Göteborgs Trafikskola AB" → "goteborgs-trafikskola-ab"). */
export function slugifyText(input: string): string {
  return input
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** First 8 characters of the instructor id with uuid dashes stripped. */
export function schoolShortId(id: string): string {
  return id.replace(/-/g, '').slice(0, 8);
}

/** Canonical school detail path, e.g. /trafikskola/goteborg/moderna-trafikskola-7cb0cb93 */
export function schoolPath(school: SchoolPathSource): string {
  const city = slugifyText(school.city) || 'sverige';
  const name = slugifyText(school.name) || 'trafikskola';
  return `/trafikskola/${city}/${name}-${schoolShortId(school.id)}`;
}

/** Splits ".../moderna-trafikskola-7cb0cb93" into { nameSlug, id8 }, or null when no id suffix is present. */
export function parseSchoolSlug(slug: string): { nameSlug: string; id8: string } | null {
  const dash = slug.lastIndexOf('-');
  if (dash <= 0) return null;
  const tail = slug.slice(dash + 1);
  if (tail.length !== 8 || !/^[0-9a-z]{8}$/.test(tail)) return null;
  return { nameSlug: slug.slice(0, dash), id8: tail };
}
