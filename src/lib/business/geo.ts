// @polsia:user-owned — geo helpers for directory distance filtering.
// Plain TypeScript (no `server-only`, no `'use client'`), safe to import from
// route handlers and unit tests. Coordinates use decimal degrees, kilometres
// is the distance unit surfaced to the client.

const EARTH_RADIUS_KM = 6371;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

export function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const lat1 = toRad(aLat);
  const lat2 = toRad(bLat);
  const h = Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

// Fallback table of common Swedish centres. Used when a row's `latitude` /
// `longitude` columns are NULL (legacy rows without coords set during
// bootstrap) so the distance filter still has a meaningful answer for them.
// Match keys are case-folded city names exactly as stored on
// `Instructor.city` (Swedish spelling, no diacritic shifts).
export const INSTRUCTOR_CITY_COORDS: Record<string, { latitude: number; longitude: number }> = {
  stockholm: { latitude: 59.3293, longitude: 18.0686 },
  göteborg: { latitude: 57.7089, longitude: 11.9746 },
  malmö: { latitude: 55.6044, longitude: 13.0038 },
  uppsala: { latitude: 59.8586, longitude: 17.6389 },
  linköping: { latitude: 58.4108, longitude: 15.6215 },
  örebro: { latitude: 59.2753, longitude: 15.2133 },
  västerås: { latitude: 59.6099, longitude: 16.5448 },
  norrköping: { latitude: 58.5877, longitude: 16.1927 },
  helsingborg: { latitude: 56.0465, longitude: 12.6945 },
  jönköping: { latitude: 57.7826, longitude: 14.1618 },
  lund: { latitude: 55.7047, longitude: 13.191 },
  umeå: { latitude: 63.8258, longitude: 20.263 },
  karlstad: { latitude: 59.4021, longitude: 13.5115 },
  borås: { latitude: 57.721, longitude: 12.9401 },
  eskilstuna: { latitude: 59.3713, longitude: 16.5097 },
  gävle: { latitude: 60.6749, longitude: 17.1413 },
};

type RowWithCoords = { city: string; latitude: number | null; longitude: number | null };

export function resolveInstructorCoords(
  row: RowWithCoords,
): { latitude: number; longitude: number } | null {
  if (typeof row.latitude === 'number' && typeof row.longitude === 'number') {
    return { latitude: row.latitude, longitude: row.longitude };
  }
  const key = row.city.trim().toLowerCase();
  return INSTRUCTOR_CITY_COORDS[key] ?? null;
}
