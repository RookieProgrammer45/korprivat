import dataset from '../../../data/inspections/published.json';

/** A published inspection price. A row exists only when the station or the authority page stated the amount. */
export type InspectionVehicle = 'car' | 'motorcycle' | 'heavy' | 'van';
export type InspectionKind = 'periodic' | 'retest' | 'periodicEmissions';
export type InspectionPriceKind = 'fixed' | 'from' | 'maximum';
export type InspectionNote =
  | 'inclVat'
  | 'inclVatAuthorityFee'
  | 'inclVatTrafficTax'
  | 'noVatMaximum'
  | 'lowestPrice'
  | 'prepayOnline'
  | 'whenBooked'
  | 'hallList'
  | 'partnerMayDiffer'
  | 'retestIfRepaired'
  | 'namedWorkshops';

export type PublishedInspection = {
  id: string;
  country: string;
  provider: string;
  place: string;
  vehicle: InspectionVehicle;
  inspection: InspectionKind;
  priceKind: InspectionPriceKind;
  amount: number;
  currency: string;
  notes: InspectionNote[];
  sourceUrl: string;
};

const VEHICLES: readonly InspectionVehicle[] = ['car', 'motorcycle', 'heavy', 'van'];
const INSPECTIONS: readonly InspectionKind[] = ['periodic', 'retest', 'periodicEmissions'];
const PRICE_KINDS: readonly InspectionPriceKind[] = ['fixed', 'from', 'maximum'];
const NOTES: readonly InspectionNote[] = [
  'inclVat',
  'inclVatAuthorityFee',
  'inclVatTrafficTax',
  'noVatMaximum',
  'lowestPrice',
  'prepayOnline',
  'whenBooked',
  'hallList',
  'partnerMayDiffer',
  'retestIfRepaired',
  'namedWorkshops',
];

/** Same-currency amounts sort by price. Different currencies sort by rank, never by the number. */
const CURRENCY_RANK: Record<string, number> = { SEK: 0, NOK: 1, DKK: 2, EUR: 3, GBP: 4 };

function isMember<T extends string>(values: readonly T[], value: string): value is T {
  return (values as readonly string[]).includes(value);
}

function publishedRows(): PublishedInspection[] {
  return dataset.rows.map((row) => {
    if (!isMember(VEHICLES, row.vehicle)) throw new Error(`inspection vehicle ${row.id}`);
    if (!isMember(INSPECTIONS, row.inspection)) throw new Error(`inspection kind ${row.id}`);
    if (!isMember(PRICE_KINDS, row.priceKind)) throw new Error(`inspection price ${row.id}`);
    if (!/^https:\/\//.test(row.sourceUrl)) throw new Error(`inspection source ${row.id}`);
    if (!/^[A-Z]{2}$/.test(row.country)) throw new Error(`inspection country ${row.id}`);
    if (!/^[A-Z]{3}$/.test(row.currency)) throw new Error(`inspection currency ${row.id}`);
    if (!(row.amount > 0)) throw new Error(`inspection amount ${row.id}`);
    const notes = row.notes.filter((note): note is InspectionNote => isMember(NOTES, note));
    if (notes.length !== row.notes.length) throw new Error(`inspection note ${row.id}`);
    return {
      ...row,
      vehicle: row.vehicle,
      inspection: row.inspection,
      priceKind: row.priceKind,
      notes,
    };
  });
}

const ROWS = publishedRows();

export function publishedInspections(): PublishedInspection[] {
  return ROWS;
}

export function inspectionCountries(): string[] {
  return [...new Set(ROWS.map((row) => row.country))].sort();
}

export type InspectionFilters = {
  country: string | null;
  vehicle: InspectionVehicle;
  inspection: InspectionKind;
};

export function inspectionFiltersFromSearch(input: {
  country?: string;
  vehicle?: string;
  inspection?: string;
}): InspectionFilters {
  const country = input.country?.trim().toUpperCase() ?? '';
  return {
    country: /^[A-Z]{2}$/.test(country) ? country : null,
    vehicle: input.vehicle && isMember(VEHICLES, input.vehicle) ? input.vehicle : 'car',
    inspection:
      input.inspection && isMember(INSPECTIONS, input.inspection) ? input.inspection : 'periodic',
  };
}

export function compareInspectionPrice(a: PublishedInspection, b: PublishedInspection): number {
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

export function listInspections(filters: InspectionFilters): PublishedInspection[] {
  return ROWS.filter((row) => {
    if (filters.country && row.country !== filters.country) return false;
    if (row.vehicle !== filters.vehicle) return false;
    if (row.inspection !== filters.inspection) return false;
    return true;
  }).sort(compareInspectionPrice);
}

export function groupInspectionsByCurrency(
  rows: readonly PublishedInspection[],
): { currency: string; rows: PublishedInspection[] }[] {
  const groups: { currency: string; rows: PublishedInspection[] }[] = [];
  for (const row of rows) {
    const last = groups[groups.length - 1];
    if (last && last.currency === row.currency) last.rows.push(row);
    else groups.push({ currency: row.currency, rows: [row] });
  }
  return groups;
}
