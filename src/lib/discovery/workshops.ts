/** A car-repair workshop mapped on OpenStreetMap. Price is not part of the record. */

export type Workshop = {
  id: string;
  country: string;
  name: string;
  street: string;
  postcode: string;
  city: string;
  website: string;
  sourceUrl: string;
};

export const WORKSHOP_PAGE_SIZE = 48;
export const WORKSHOP_CITY_UNKNOWN = '__none';

const SOURCE = /^https:\/\/www\.openstreetmap\.org\/(?:node|way|relation)\/\d+$/;

export function foldWorkshopPlace(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLocaleLowerCase('sv')
    .replace(/\s+/g, ' ')
    .trim();
}

export function workshopAddress(row: Pick<Workshop, 'street' | 'postcode' | 'city'>): string {
  const locality = [row.postcode, row.city].filter((part) => part.length > 0).join(' ');
  return [row.street, locality].filter((part) => part.length > 0).join(', ');
}

export function parseWorkshop(country: string, value: unknown): Workshop | null {
  if (!value || typeof value !== 'object') return null;
  const row = value as Record<string, unknown>;
  if (typeof row.id !== 'string' || typeof row.name !== 'string') return null;
  if (typeof row.street !== 'string' || typeof row.postcode !== 'string') return null;
  if (typeof row.city !== 'string' || typeof row.website !== 'string') return null;
  if (typeof row.sourceUrl !== 'string' || !SOURCE.test(row.sourceUrl)) return null;
  const name = row.name.trim();
  if (name.length < 1 || name.length > 120) return null;
  if (row.street.length > 160 || row.postcode.length > 16 || row.city.length > 80) return null;
  if (row.website.length > 0 && !row.website.startsWith('https://')) return null;
  if (!/^[A-Z]{2}$/.test(country)) return null;
  return {
    id: row.id,
    country,
    name,
    street: row.street,
    postcode: row.postcode,
    city: row.city,
    website: row.website,
    sourceUrl: row.sourceUrl,
  };
}

export function workshopCities(rows: readonly Workshop[]): string[] {
  const cities = new Set<string>();
  for (const row of rows) {
    if (row.city) cities.add(row.city);
  }
  return [...cities].sort((a, b) => a.localeCompare(b, 'sv'));
}

export function workshopsForCity(rows: readonly Workshop[], city: string | null): Workshop[] {
  if (!city) return [];
  if (city === WORKSHOP_CITY_UNKNOWN) return rows.filter((row) => row.city.length === 0);
  const wanted = foldWorkshopPlace(city);
  return rows.filter((row) => foldWorkshopPlace(row.city) === wanted);
}

export type WorkshopFilters = {
  country: string | null;
  city: string | null;
  page: number;
};

export function workshopFiltersFromSearch(
  input: { country?: string; city?: string; page?: string },
  countries: readonly string[],
): WorkshopFilters {
  const requested = input.country?.trim().toUpperCase() ?? '';
  const country = countries.includes(requested)
    ? requested
    : countries.includes('SE')
      ? 'SE'
      : (countries[0] ?? null);
  const city = input.city?.trim().replace(/\s+/g, ' ') ?? '';
  const page = Number(input.page);
  return {
    country,
    city: city.length > 0 && city.length <= 80 ? city : null,
    page: Number.isInteger(page) && page > 0 ? page : 1,
  };
}

export function pageOfWorkshops(
  rows: readonly Workshop[],
  page: number,
): { rows: Workshop[]; total: number; pages: number } {
  const total = rows.length;
  const pages = Math.max(1, Math.ceil(total / WORKSHOP_PAGE_SIZE));
  const current = Math.min(page, pages);
  const start = (current - 1) * WORKSHOP_PAGE_SIZE;
  return { rows: rows.slice(start, start + WORKSHOP_PAGE_SIZE), total, pages };
}
