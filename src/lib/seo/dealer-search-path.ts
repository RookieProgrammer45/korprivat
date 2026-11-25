const VEHICLE_KINDS = new Set(['car', 'van', 'heavy', 'other']);

/** Public comparison URL. City and kind are omitted when they do not narrow the list. */
export function dealerSearchPath(city: string, kind?: string | null): string {
  const params = new URLSearchParams();
  const trimmed = city.trim();
  if (trimmed) params.set('city', trimmed);
  if (kind && VEHICLE_KINDS.has(kind)) params.set('kind', kind);
  const query = params.toString();
  return query ? `/bilhandlare?${query}` : '/bilhandlare';
}
