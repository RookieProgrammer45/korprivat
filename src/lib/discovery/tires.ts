import { tireAppliesAtPlace } from '@/lib/discovery/tire-place';
import dataset from '../../../data/tires/published.json';

/** A published tire-service price. A row exists only when the workshop page stated the amount. */
export type TireVehicle = 'car' | 'van';
export type TireService = 'change' | 'hotel' | 'mount' | 'mobile';
export type TirePriceKind = 'fixed' | 'from' | 'maximum';
export type TireNote =
  | 'wheelsBrought'
  | 'extrasMayApply'
  | 'includesCheck'
  | 'includesChange'
  | 'includesChangeAndWash'
  | 'includesChangeWashAndCheck'
  | 'ownTyres'
  | 'storageOnly'
  | 'fourWheels'
  | 'upTo14Inch'
  | 'memberDiscount'
  | 'boughtElsewhere'
  | 'slotMaximum';

export type PublishedTire = {
  id: string;
  country: string;
  provider: string;
  place: string;
  vehicle: TireVehicle;
  service: TireService;
  priceKind: TirePriceKind;
  amount: number;
  currency: string;
  notes: TireNote[];
  sourceUrl: string;
};

const VEHICLES: readonly TireVehicle[] = ['car', 'van'];
const SERVICES: readonly TireService[] = ['change', 'hotel', 'mount', 'mobile'];
const PRICE_KINDS: readonly TirePriceKind[] = ['fixed', 'from', 'maximum'];
const NOTES: readonly TireNote[] = [
  'wheelsBrought',
  'extrasMayApply',
  'includesCheck',
  'includesChange',
  'includesChangeAndWash',
  'includesChangeWashAndCheck',
  'ownTyres',
  'storageOnly',
  'fourWheels',
  'upTo14Inch',
  'memberDiscount',
  'boughtElsewhere',
  'slotMaximum',
];

/** Same-currency amounts sort by price. Different currencies sort by rank, never by the number. */
const CURRENCY_RANK: Record<string, number> = { SEK: 0, NOK: 1, DKK: 2, EUR: 3, GBP: 4 };

function isMember<T extends string>(values: readonly T[], value: string): value is T {
  return (values as readonly string[]).includes(value);
}

function publishedRows(): PublishedTire[] {
  return dataset.rows.map((row) => {
    if (!isMember(VEHICLES, row.vehicle)) throw new Error(`tire vehicle ${row.id}`);
    if (!isMember(SERVICES, row.service)) throw new Error(`tire service ${row.id}`);
    if (!isMember(PRICE_KINDS, row.priceKind)) throw new Error(`tire price ${row.id}`);
    if (!/^https:\/\//.test(row.sourceUrl)) throw new Error(`tire source ${row.id}`);
    if (!/^[A-Z]{2}$/.test(row.country)) throw new Error(`tire country ${row.id}`);
    if (!/^[A-Z]{3}$/.test(row.currency)) throw new Error(`tire currency ${row.id}`);
    if (!(row.amount > 0)) throw new Error(`tire amount ${row.id}`);
    const notes = row.notes.filter((note): note is TireNote => isMember(NOTES, note));
    if (notes.length !== row.notes.length) throw new Error(`tire note ${row.id}`);
    return { ...row, vehicle: row.vehicle, service: row.service, priceKind: row.priceKind, notes };
  });
}

const ROWS = publishedRows();

export function publishedTires(): PublishedTire[] {
  return ROWS;
}

export function tireCountries(): string[] {
  return [...new Set(ROWS.map((row) => row.country))].sort();
}

export type TireFilters = {
  country: string | null;
  place: string | null;
  vehicle: TireVehicle;
  service: TireService;
};

export function tireFiltersFromSearch(input: {
  country?: string;
  place?: string;
  vehicle?: string;
  service?: string;
}): TireFilters {
  const country = input.country?.trim().toUpperCase() ?? '';
  const place = input.place?.trim().replace(/\s+/g, ' ') ?? '';
  return {
    country: /^[A-Z]{2}$/.test(country) ? country : null,
    place: place.length > 0 && place.length <= 80 ? place : null,
    vehicle: input.vehicle && isMember(VEHICLES, input.vehicle) ? input.vehicle : 'car',
    service: input.service && isMember(SERVICES, input.service) ? input.service : 'change',
  };
}

export function compareTirePrice(a: PublishedTire, b: PublishedTire): number {
  const rank = (currency: string) => CURRENCY_RANK[currency] ?? 50;
  const byRank = rank(a.currency) - rank(b.currency);
  if (byRank !== 0) return byRank;
  const byCode = a.currency.localeCompare(b.currency);
  if (byCode !== 0) return byCode;
  return (
    a.amount - b.amount ||
    a.place.localeCompare(b.place, 'sv') ||
    a.provider.localeCompare(b.provider)
  );
}

export function listTires(filters: TireFilters): PublishedTire[] {
  return ROWS.filter((row) => {
    if (filters.country && row.country !== filters.country) return false;
    if (filters.place && !tireAppliesAtPlace(row, filters.place)) return false;
    if (row.vehicle !== filters.vehicle) return false;
    if (row.service !== filters.service) return false;
    return true;
  }).sort(compareTirePrice);
}

export function groupTiresByCurrency(
  rows: readonly PublishedTire[],
): { currency: string; rows: PublishedTire[] }[] {
  const groups: { currency: string; rows: PublishedTire[] }[] = [];
  for (const row of rows) {
    const last = groups[groups.length - 1];
    if (last && last.currency === row.currency) last.rows.push(row);
    else groups.push({ currency: row.currency, rows: [row] });
  }
  return groups;
}
