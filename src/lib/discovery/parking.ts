import dataset from '../../../data/parking/published.json';

/** A published parking hour. A row exists only when that page named the place and the hour price. */
export type ParkingNote =
  | 'allDay'
  | 'daytime0822'
  | 'daytime0820'
  | 'daytime0818'
  | 'weekday921'
  | 'fossilHour'
  | 'signWins'
  | 'maxTwoHours'
  | 'loadingCombined'
  | 'feeWindow1320'
  | 'feeWindow0920'
  | 'weekendFirstHour'
  | 'prepaid'
  | 'outerCityGuest';

export type PublishedParking = {
  id: string;
  country: string;
  city: string;
  spot: string;
  place: string;
  provider: string;
  priceKind: 'fixed';
  unit: 'hour';
  amount: number;
  currency: string;
  notes: ParkingNote[];
  sourceUrl: string;
  checkedAt: string;
};

const NOTES: readonly ParkingNote[] = [
  'allDay',
  'daytime0822',
  'daytime0820',
  'daytime0818',
  'weekday921',
  'fossilHour',
  'signWins',
  'maxTwoHours',
  'loadingCombined',
  'feeWindow1320',
  'feeWindow0920',
  'weekendFirstHour',
  'prepaid',
  'outerCityGuest',
];

const CURRENCY_RANK: Record<string, number> = { SEK: 0, NOK: 1, DKK: 2, EUR: 3, GBP: 4 };

function isMember<T extends string>(values: readonly T[], value: string): value is T {
  return (values as readonly string[]).includes(value);
}

function publishedRows(): PublishedParking[] {
  return dataset.rows.map((row) => {
    const id = row.id;
    if (row.priceKind !== 'fixed' || row.unit !== 'hour') throw new Error(`parking unit ${id}`);
    if (!/^https:\/\//.test(row.sourceUrl)) throw new Error(`parking source ${id}`);
    if (!/^[A-Z]{2}$/.test(row.country)) throw new Error(`parking country ${id}`);
    if (!/^[a-z0-9-]+$/.test(row.city)) throw new Error(`parking city ${id}`);
    if (!/^[A-Z]{3}$/.test(row.currency)) throw new Error(`parking currency ${id}`);
    if (!(row.amount > 0)) throw new Error(`parking amount ${id}`);
    if (!row.spot.trim() || !row.provider.trim()) throw new Error(`parking name ${id}`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(row.checkedAt)) throw new Error(`parking checked ${id}`);
    const notes = row.notes.filter((note): note is ParkingNote => isMember(NOTES, note));
    if (notes.length !== row.notes.length) throw new Error(`parking note ${id}`);
    return { ...row, priceKind: 'fixed', unit: 'hour', notes };
  });
}

const ROWS = publishedRows();

export function publishedParking(): PublishedParking[] {
  return ROWS;
}

export function parkingCountries(): string[] {
  return [...new Set(ROWS.map((row) => row.country))].sort();
}

export function parkingCities(country: string | null): string[] {
  const rows = country ? ROWS.filter((row) => row.country === country) : ROWS;
  return [...new Set(rows.map((row) => row.city))];
}

export type ParkingFilters = {
  country: string | null;
  city: string | null;
};

export function parkingFiltersFromSearch(input: {
  country?: string;
  city?: string;
}): ParkingFilters {
  const countryCode = input.country?.trim().toUpperCase() ?? '';
  const country = /^[A-Z]{2}$/.test(countryCode) ? countryCode : null;
  const city = input.city?.trim().toLowerCase() ?? '';
  const known = new Set(parkingCities(country));
  return { country, city: known.has(city) ? city : null };
}

export function compareParkingPrice(a: PublishedParking, b: PublishedParking): number {
  const rank = (currency: string) => CURRENCY_RANK[currency] ?? 50;
  const byRank = rank(a.currency) - rank(b.currency);
  if (byRank !== 0) return byRank;
  const byCode = a.currency.localeCompare(b.currency);
  if (byCode !== 0) return byCode;
  return a.amount - b.amount || a.spot.localeCompare(b.spot, 'sv') || a.city.localeCompare(b.city);
}

export function listParking(filters: ParkingFilters): PublishedParking[] {
  return ROWS.filter((row) => (filters.country ? row.country === filters.country : true))
    .filter((row) => (filters.city ? row.city === filters.city : true))
    .sort(compareParkingPrice);
}

export function groupParkingByCurrency(
  rows: readonly PublishedParking[],
): { currency: string; rows: PublishedParking[] }[] {
  const groups: { currency: string; rows: PublishedParking[] }[] = [];
  for (const row of rows) {
    const last = groups[groups.length - 1];
    if (last && last.currency === row.currency) last.rows.push(row);
    else groups.push({ currency: row.currency, rows: [row] });
  }
  return groups;
}
