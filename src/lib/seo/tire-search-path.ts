import type { TireFilters } from '@/lib/discovery/tires';

/** Public comparison URL. The default view (any country, car, wheel change) has no query. */
export function tireSearchPath(filters: TireFilters): string {
  const params = new URLSearchParams();
  if (filters.country) params.set('country', filters.country);
  if (filters.vehicle !== 'car') params.set('vehicle', filters.vehicle);
  if (filters.service !== 'change') params.set('service', filters.service);
  const search = params.toString();
  return search ? `/dack?${search}` : '/dack';
}
