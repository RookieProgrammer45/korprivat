import { haversineKm, INSTRUCTOR_CITY_COORDS } from '@/lib/business/geo';
import { SEARCH_CITIES } from '@/lib/seo/school-search-path';

/** Cities the tire catalogue can filter, using the same names as the homepage search. */
export type TirePlace = {
  id: string;
  value: string;
  country: string;
};

const TIRE_COUNTRIES = new Set(['SE', 'NO', 'FI', 'NL', 'GB']);

const EXTRA_PLACES: TirePlace[] = [
  { id: 'helsinki', value: 'Helsinki', country: 'FI' },
  { id: 'amsterdam', value: 'Amsterdam', country: 'NL' },
];

/** City-centre points for places that are not in the Swedish instructor table. */
const OTHER_CENTERS: Record<string, { latitude: number; longitude: number }> = {
  oslo: { latitude: 59.9139, longitude: 10.7522 },
  bergen: { latitude: 60.3913, longitude: 5.3221 },
  trondheim: { latitude: 63.4305, longitude: 10.3951 },
  stavanger: { latitude: 58.97, longitude: 5.7331 },
  tromso: { latitude: 69.6492, longitude: 18.9553 },
  helsinki: { latitude: 60.1699, longitude: 24.9384 },
  amsterdam: { latitude: 52.3676, longitude: 4.9041 },
  london: { latitude: 51.5074, longitude: -0.1278 },
  manchester: { latitude: 53.4808, longitude: -2.2426 },
  birmingham: { latitude: 52.4862, longitude: -1.8904 },
  leeds: { latitude: 53.8008, longitude: -1.5491 },
  glasgow: { latitude: 55.8642, longitude: -4.2518 },
  cardiff: { latitude: 51.4816, longitude: -3.1791 },
};

function countryFromHref(href: string): string {
  return href.split('/')[2]?.toUpperCase() ?? '';
}

export const TIRE_PLACES: TirePlace[] = [
  ...SEARCH_CITIES.flatMap((city) => {
    const country = countryFromHref(city.href);
    if (!TIRE_COUNTRIES.has(country)) return [];
    return [{ id: city.id, value: city.value, country }];
  }),
  ...EXTRA_PLACES,
];

export function foldPlace(value: string): string {
  return value.trim().toLocaleLowerCase('sv').normalize('NFD').replace(/\p{M}/gu, '');
}

export function tireCityCountry(place: string): string | null {
  const key = foldPlace(place);
  return TIRE_PLACES.find((city) => foldPlace(city.value) === key)?.country ?? null;
}

function centerFor(city: TirePlace): { latitude: number; longitude: number } | null {
  if (city.country === 'SE') {
    return INSTRUCTOR_CITY_COORDS[city.value.trim().toLocaleLowerCase('sv')] ?? null;
  }
  return OTHER_CENTERS[foldPlace(city.value)] ?? null;
}

/** Nearest catalogue city, or null when the visitor is farther than `maxKm`. */
export function nearestTireCity(lat: number, lng: number, maxKm = 50): string | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  let best: { value: string; km: number } | null = null;
  for (const city of TIRE_PLACES) {
    const center = centerFor(city);
    if (!center) continue;
    const km = haversineKm(lat, lng, center.latitude, center.longitude);
    if (!best || km < best.km) best = { value: city.value, km };
  }
  return best && best.km <= maxKm ? best.value : null;
}

/** A named workshop place matches the city. A blank place is a country-wide published price. */
export function tireAppliesAtPlace(
  row: { place: string; country: string },
  place: string,
): boolean {
  const wanted = foldPlace(place);
  if (!wanted) return true;
  const named = row.place
    .split(',')
    .map((part) => foldPlace(part))
    .filter(Boolean)
    .includes(wanted);
  if (named) return true;
  if (row.place.trim() !== '') return false;
  const country = tireCityCountry(place);
  return country != null && row.country === country;
}
