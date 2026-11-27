import type { ParkingFilters } from '@/lib/discovery/parking';

/** Public comparison URL. The default view, any city, has no query. */
export function parkingSearchPath(filters: ParkingFilters): string {
  const params = new URLSearchParams();
  if (filters.country) params.set('country', filters.country);
  if (filters.city) params.set('city', filters.city);
  const search = params.toString();
  return search ? `/parkering?${search}` : '/parkering';
}
