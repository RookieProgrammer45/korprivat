import type { LeaseFilters } from '@/lib/discovery/leasing';

/** Public comparison URL. The default view, any country, has no query. */
export function leasingSearchPath(filters: LeaseFilters): string {
  const params = new URLSearchParams();
  if (filters.country) params.set('country', filters.country);
  const search = params.toString();
  return search ? `/privatleasing?${search}` : '/privatleasing';
}
