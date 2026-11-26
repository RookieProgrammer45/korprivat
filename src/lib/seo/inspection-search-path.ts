import type { InspectionFilters } from '@/lib/discovery/inspections';

/** Public comparison URL. The default view (any country, car, periodic) has no query. */
export function inspectionSearchPath(filters: InspectionFilters): string {
  const params = new URLSearchParams();
  if (filters.country) params.set('country', filters.country);
  if (filters.vehicle !== 'car') params.set('vehicle', filters.vehicle);
  if (filters.inspection !== 'periodic') params.set('inspection', filters.inspection);
  const search = params.toString();
  return search ? `/besiktning?${search}` : '/besiktning';
}
