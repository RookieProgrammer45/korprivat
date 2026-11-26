const VEHICLE_KINDS = new Set(['car', 'van', 'heavy', 'motorcycle', 'other']);

/** Public comparison URL. Empty parts are omitted. */
export function dealerSearchPath(
  city: string,
  kind?: string | null,
  model?: string | null,
): string {
  const params = new URLSearchParams();
  const trimmed = city.trim();
  const q = model?.trim() ?? '';
  if (q) params.set('q', q);
  if (trimmed) params.set('city', trimmed);
  if (kind && VEHICLE_KINDS.has(kind)) params.set('kind', kind);
  const query = params.toString();
  return query ? `/bilhandlare?${query}` : '/bilhandlare';
}
