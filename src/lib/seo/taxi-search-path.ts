import type { TaxiFilters } from '@/lib/discovery/taxi-training';

/** Public comparison URL. The default view (any country, course) has no query. */
export function taxiSearchPath(filters: TaxiFilters): string {
  const params = new URLSearchParams();
  if (filters.country) params.set('country', filters.country);
  if (filters.kind !== 'course') params.set('kind', filters.kind);
  const search = params.toString();
  return search ? `/taxiutbildning?${search}` : '/taxiutbildning';
}
