import dataset from '../../../data/leasing/published.json';

/** A published private-lease price. A row exists only when that page named the model and the monthly amount. */
export type LeasePriceKind = 'fixed' | 'from' | 'maximum';
export type LeaseMileageScope = 'year' | 'term';
export type LeaseNote =
  | 'offerThrough20261231'
  | 'termNotOnPage'
  | 'variableFee'
  | 'mileageChoice'
  | 'taxListedSeparately'
  | 'feesExtra'
  | 'serviceIncluded'
  | 'kiaFinans'
  | 'noDeposit'
  | 'inclVat'
  | 'utrechtRegion'
  | 'excess500'
  | 'fuelNotIncluded'
  | 'examplePrice'
  | 'noInitialPayment'
  | 'includesTyresService'
  | 'providedByKAuto'
  | 'initialPayment140685'
  | 'interestCanChange'
  | 'deliveredOslo';

export type PublishedLease = {
  id: string;
  country: string;
  provider: string;
  place: string;
  model: string;
  priceKind: LeasePriceKind;
  amount: number;
  currency: string;
  termMonths: number | null;
  mileageKm: number | null;
  mileageScope: LeaseMileageScope | null;
  notes: LeaseNote[];
  sourceUrl: string;
};

const PRICE_KINDS: readonly LeasePriceKind[] = ['fixed', 'from', 'maximum'];
const SCOPES: readonly LeaseMileageScope[] = ['year', 'term'];
const NOTES: readonly LeaseNote[] = [
  'offerThrough20261231',
  'termNotOnPage',
  'variableFee',
  'mileageChoice',
  'taxListedSeparately',
  'feesExtra',
  'serviceIncluded',
  'kiaFinans',
  'noDeposit',
  'inclVat',
  'utrechtRegion',
  'excess500',
  'fuelNotIncluded',
  'examplePrice',
  'noInitialPayment',
  'includesTyresService',
  'providedByKAuto',
  'initialPayment140685',
  'interestCanChange',
  'deliveredOslo',
];

/** Same-currency amounts sort by price. Different currencies sort by rank, never by the number. */
const CURRENCY_RANK: Record<string, number> = { SEK: 0, NOK: 1, DKK: 2, EUR: 3, GBP: 4 };

function isMember<T extends string>(values: readonly T[], value: string): value is T {
  return (values as readonly string[]).includes(value);
}

function publishedRows(): PublishedLease[] {
  return dataset.rows.map((row) => {
    const id = row.id;
    if (!isMember(PRICE_KINDS, row.priceKind)) throw new Error(`lease price ${id}`);
    if (!/^https:\/\//.test(row.sourceUrl)) throw new Error(`lease source ${id}`);
    if (!/^[A-Z]{2}$/.test(row.country)) throw new Error(`lease country ${id}`);
    if (!/^[A-Z]{3}$/.test(row.currency)) throw new Error(`lease currency ${id}`);
    if (!(row.amount > 0)) throw new Error(`lease amount ${id}`);
    if (!row.model.trim()) throw new Error(`lease model ${id}`);
    const termMonths = row.termMonths;
    if (termMonths !== null && !(Number.isInteger(termMonths) && termMonths > 0)) {
      throw new Error(`lease term ${id}`);
    }
    const mileageKm = row.mileageKm;
    const scope = row.mileageScope;
    let mileageScope: LeaseMileageScope | null = null;
    if (scope !== null) {
      if (!isMember(SCOPES, scope)) throw new Error(`lease mileage ${id}`);
      mileageScope = scope;
    }
    if (
      (mileageKm === null) !== (mileageScope === null) ||
      (mileageKm !== null && !(mileageKm > 0))
    ) {
      throw new Error(`lease mileage ${id}`);
    }
    const notes = row.notes.filter((note): note is LeaseNote => isMember(NOTES, note));
    if (notes.length !== row.notes.length) throw new Error(`lease note ${id}`);
    return {
      ...row,
      priceKind: row.priceKind,
      termMonths,
      mileageKm,
      mileageScope,
      notes,
    };
  });
}

const ROWS = publishedRows();

export function publishedLeases(): PublishedLease[] {
  return ROWS;
}

export function leaseCountries(): string[] {
  return [...new Set(ROWS.map((row) => row.country))].sort();
}

export type LeaseFilters = {
  country: string | null;
};

export function leaseFiltersFromSearch(input: { country?: string }): LeaseFilters {
  const country = input.country?.trim().toUpperCase() ?? '';
  return { country: /^[A-Z]{2}$/.test(country) ? country : null };
}

export function compareLeasePrice(a: PublishedLease, b: PublishedLease): number {
  const rank = (currency: string) => CURRENCY_RANK[currency] ?? 50;
  const byRank = rank(a.currency) - rank(b.currency);
  if (byRank !== 0) return byRank;
  const byCode = a.currency.localeCompare(b.currency);
  if (byCode !== 0) return byCode;
  return (
    a.amount - b.amount ||
    a.model.localeCompare(b.model, 'sv') ||
    a.provider.localeCompare(b.provider)
  );
}

export function listLeases(filters: LeaseFilters): PublishedLease[] {
  return ROWS.filter((row) => (filters.country ? row.country === filters.country : true)).sort(
    compareLeasePrice,
  );
}

export function groupLeasesByCurrency(
  rows: readonly PublishedLease[],
): { currency: string; rows: PublishedLease[] }[] {
  const groups: { currency: string; rows: PublishedLease[] }[] = [];
  for (const row of rows) {
    const last = groups[groups.length - 1];
    if (last && last.currency === row.currency) last.rows.push(row);
    else groups.push({ currency: row.currency, rows: [row] });
  }
  return groups;
}
