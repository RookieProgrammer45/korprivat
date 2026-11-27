// Online logistic model for published catalogues.
// It reorders rows that already exist. It never creates a listing, never
// changes an amount, and never sorts one currency by another currency's number.
// With no clicks, the order is the published price order.

export const CATALOGUES = [
  'lease',
  'tire',
  'taxi',
  'inspection',
  'parking',
  'part',
  'car',
  'school',
] as const;
export type CatalogueName = (typeof CATALOGUES)[number];

export type Rankable = {
  id: string;
  currency: string;
  amount: number | null;
  country: string;
  checkedAt: string | null;
};

export type CatalogueModel = {
  samples: number;
  sameCountry: number;
  fresh: number;
  bias: Record<string, number>;
};

export const EMPTY_MODEL: CatalogueModel = {
  samples: 0,
  sameCountry: 0,
  fresh: 0,
  bias: {},
};

const CURRENCY_RANK: Record<string, number> = {
  SEK: 0,
  NOK: 1,
  DKK: 2,
  EUR: 3,
  GBP: 4,
  USD: 5,
  AUD: 6,
};
const LEARNING_RATE = 0.2;
const DECAY = 0.01;
const WEIGHT_CAP = 2;
const SHIFT = 0.35;
const FRESH_MS = 60 * 24 * 60 * 60 * 1000;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function sigmoid(value: number): number {
  if (value > 20) return 1;
  if (value < -20) return 0;
  return 1 / (1 + Math.exp(-value));
}

function features(
  item: Rankable,
  visitorCountry: string,
  now: number,
): { sameCountry: number; fresh: number } {
  const sameCountry =
    visitorCountry.length === 2 && item.country.toUpperCase() === visitorCountry.toUpperCase()
      ? 1
      : 0;
  const checked = item.checkedAt ? Date.parse(item.checkedAt) : Number.NaN;
  const fresh = Number.isFinite(checked) && now - checked <= FRESH_MS ? 1 : 0;
  return { sameCountry, fresh };
}

function logit(model: CatalogueModel, item: Rankable, visitorCountry: string, now: number): number {
  const x = features(item, visitorCountry, now);
  return model.sameCountry * x.sameCountry + model.fresh * x.fresh + (model.bias[item.id] ?? 0);
}

export function isCatalogueName(value: string): value is CatalogueName {
  return (CATALOGUES as readonly string[]).includes(value);
}

/** One opened listing. The published row is the only input; a missing id is ignored by the caller. */
export function learnClick(
  model: CatalogueModel,
  item: Rankable,
  visitorCountry: string,
  now: number,
): CatalogueModel {
  const x = features(item, visitorCountry, now);
  const error = 1 - sigmoid(logit(model, item, visitorCountry, now));
  const bias: Record<string, number> = {};
  for (const [id, value] of Object.entries(model.bias)) {
    const decayed = value * (1 - DECAY);
    if (Math.abs(decayed) >= 0.001) bias[id] = decayed;
  }
  bias[item.id] = clamp((bias[item.id] ?? 0) + LEARNING_RATE * error, -WEIGHT_CAP, WEIGHT_CAP);
  return {
    samples: model.samples + 1,
    sameCountry: clamp(
      model.sameCountry * (1 - DECAY) + LEARNING_RATE * error * x.sameCountry,
      -WEIGHT_CAP,
      WEIGHT_CAP,
    ),
    fresh: clamp(
      model.fresh * (1 - DECAY) + LEARNING_RATE * error * x.fresh,
      -WEIGHT_CAP,
      WEIGHT_CAP,
    ),
    bias,
  };
}

export function rankCatalogue<T>(
  rows: readonly T[],
  item: (row: T) => Rankable,
  model: CatalogueModel,
  visitorCountry: string,
  now: number,
): T[] {
  const decorated = rows.map((row, index) => ({ row, index, fact: item(row) }));
  const priced = decorated.filter(
    (entry) => typeof entry.fact.amount === 'number' && entry.fact.amount > 0,
  );
  const unpriced = decorated.filter(
    (entry) => !(typeof entry.fact.amount === 'number' && entry.fact.amount > 0),
  );
  const groups = new Map<string, typeof priced>();
  for (const entry of priced) {
    const list = groups.get(entry.fact.currency) ?? [];
    list.push(entry);
    groups.set(entry.fact.currency, list);
  }
  const currencies = [...groups.keys()].sort((left, right) => {
    const byRank = (CURRENCY_RANK[left] ?? 50) - (CURRENCY_RANK[right] ?? 50);
    return byRank !== 0 ? byRank : left.localeCompare(right);
  });
  const ordered: T[] = [];
  for (const currency of currencies) {
    const group = groups.get(currency) ?? [];
    const amounts = group.map((entry) => entry.fact.amount ?? 0);
    const mean = amounts.reduce((sum, amount) => sum + amount, 0) / amounts.length;
    const variance =
      amounts.reduce((sum, amount) => sum + (amount - mean) ** 2, 0) / amounts.length;
    const sd = Math.sqrt(variance);
    const scored = group.map((entry) => {
      const amount = entry.fact.amount ?? 0;
      const z = sd > 0 ? (amount - mean) / sd : 0;
      const shift = SHIFT * (sigmoid(logit(model, entry.fact, visitorCountry, now)) - 0.5) * 2;
      return { entry, key: z - shift };
    });
    scored.sort(
      (left, right) =>
        left.key - right.key ||
        (left.entry.fact.amount ?? 0) - (right.entry.fact.amount ?? 0) ||
        left.entry.index - right.entry.index,
    );
    ordered.push(...scored.map((entry) => entry.entry.row));
  }
  unpriced.sort((left, right) => left.index - right.index);
  return [...ordered, ...unpriced.map((entry) => entry.row)];
}
