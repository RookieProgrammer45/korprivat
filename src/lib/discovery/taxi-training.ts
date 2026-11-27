import dataset from '../../../data/taxi-training/published.json';

/** A published taxi-driver course or official test fee. A row exists only when that page stated the amount. */
export type TaxiKind = 'course' | 'exam';
export type TaxiPriceKind = 'fixed' | 'from' | 'maximum';
export type TaxiNote =
  | 'questionBankAndThreeLessons'
  | 'bookAndLessonListedSeparately'
  | 'theoryMaterial'
  | 'includesTwoLessons'
  | 'localKnowledge'
  | 'authorityFeesExtra'
  | 'materialFourLessonsOneDrive'
  | 'includesWrittenTest'
  | 'privateHireCourse'
  | 'includesAssessment'
  | 'standaloneAssessment'
  | 'paidToTrainer'
  | 'topographyTest'
  | 'topographyExtra'
  | 'refresher'
  | 'weekday'
  | 'eveningWeekend';

export type PublishedTaxiTraining = {
  id: string;
  country: string;
  provider: string;
  place: string;
  kind: TaxiKind;
  priceKind: TaxiPriceKind;
  amount: number;
  currency: string;
  notes: TaxiNote[];
  sourceUrl: string;
};

const KINDS: readonly TaxiKind[] = ['course', 'exam'];
const PRICE_KINDS: readonly TaxiPriceKind[] = ['fixed', 'from', 'maximum'];
const NOTES: readonly TaxiNote[] = [
  'questionBankAndThreeLessons',
  'bookAndLessonListedSeparately',
  'theoryMaterial',
  'includesTwoLessons',
  'localKnowledge',
  'authorityFeesExtra',
  'materialFourLessonsOneDrive',
  'includesWrittenTest',
  'privateHireCourse',
  'includesAssessment',
  'standaloneAssessment',
  'paidToTrainer',
  'topographyTest',
  'topographyExtra',
  'refresher',
  'weekday',
  'eveningWeekend',
];

/** Same-currency amounts sort by price. Different currencies sort by rank, never by the number. */
const CURRENCY_RANK: Record<string, number> = { SEK: 0, NOK: 1, DKK: 2, EUR: 3, GBP: 4 };

function isMember<T extends string>(values: readonly T[], value: string): value is T {
  return (values as readonly string[]).includes(value);
}

function publishedRows(): PublishedTaxiTraining[] {
  return dataset.rows.map((row) => {
    if (!isMember(KINDS, row.kind)) throw new Error(`taxi kind ${row.id}`);
    if (!isMember(PRICE_KINDS, row.priceKind)) throw new Error(`taxi price ${row.id}`);
    if (!/^https:\/\//.test(row.sourceUrl)) throw new Error(`taxi source ${row.id}`);
    if (!/^[A-Z]{2}$/.test(row.country)) throw new Error(`taxi country ${row.id}`);
    if (!/^[A-Z]{3}$/.test(row.currency)) throw new Error(`taxi currency ${row.id}`);
    if (!(row.amount > 0)) throw new Error(`taxi amount ${row.id}`);
    const notes = row.notes.filter((note): note is TaxiNote => isMember(NOTES, note));
    if (notes.length !== row.notes.length) throw new Error(`taxi note ${row.id}`);
    return { ...row, kind: row.kind, priceKind: row.priceKind, notes };
  });
}

const ROWS = publishedRows();

export function publishedTaxiTraining(): PublishedTaxiTraining[] {
  return ROWS;
}

export function taxiCountries(): string[] {
  return [...new Set(ROWS.map((row) => row.country))].sort();
}

export type TaxiFilters = {
  country: string | null;
  kind: TaxiKind;
};

export function taxiFiltersFromSearch(input: { country?: string; kind?: string }): TaxiFilters {
  const country = input.country?.trim().toUpperCase() ?? '';
  return {
    country: /^[A-Z]{2}$/.test(country) ? country : null,
    kind: input.kind && isMember(KINDS, input.kind) ? input.kind : 'course',
  };
}

export function compareTaxiPrice(a: PublishedTaxiTraining, b: PublishedTaxiTraining): number {
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

export function listTaxiTraining(filters: TaxiFilters): PublishedTaxiTraining[] {
  return ROWS.filter((row) => {
    if (filters.country && row.country !== filters.country) return false;
    if (row.kind !== filters.kind) return false;
    return true;
  }).sort(compareTaxiPrice);
}

export function groupTaxiByCurrency(
  rows: readonly PublishedTaxiTraining[],
): { currency: string; rows: PublishedTaxiTraining[] }[] {
  const groups: { currency: string; rows: PublishedTaxiTraining[] }[] = [];
  for (const row of rows) {
    const last = groups[groups.length - 1];
    if (last && last.currency === row.currency) last.rows.push(row);
    else groups.push({ currency: row.currency, rows: [row] });
  }
  return groups;
}
