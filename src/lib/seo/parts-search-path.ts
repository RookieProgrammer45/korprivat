import { SEARCH_CITIES } from '@/lib/seo/school-search-path';

/** Cities a rider or driver can pick. New York is included because a published store can be measured from there. */
export const PART_PLACES = [
  ...SEARCH_CITIES.map((city) => ({ id: city.id, value: city.value })),
  { id: 'newYork', value: 'New York' },
] as const;

export function partsSearchPath(
  query: string,
  kind?: string | null,
  place?: string | null,
): string {
  const params = new URLSearchParams();
  const text = query.trim();
  const near = place?.trim() ?? '';
  if (text) params.set('q', text);
  if (near) params.set('place', near);
  if (kind === 'part' || kind === 'motorcycle' || kind === 'accessory') params.set('kind', kind);
  const search = params.toString();
  return search ? `/reservdelar?${search}` : '/reservdelar';
}
