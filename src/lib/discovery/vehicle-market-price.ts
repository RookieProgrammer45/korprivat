// Market estimate for a private car. Comparables are published catalogue prices
// in the same currency. The figure is a median, not an offer and not an appraisal.

export type MarketComparable = {
  country: string;
  dealerId: string;
  dealerName: string;
  dealerCity: string;
  sourceUrl: string;
  name: string;
  make: string | null;
  model: string | null;
  year: number | null;
  price: number;
  currency: string;
  priceKind: 'msrp' | 'from' | null;
};

export type MarketPriceQuery = {
  make: string;
  model: string;
  year: number | null;
  country: string;
  currency: string;
};

export type MarketBuyer = {
  dealerId: string;
  name: string;
  city: string;
  sourceUrl: string;
};

export type MarketPriceEstimate = {
  currency: string;
  amount: number | null;
  low: number | null;
  high: number | null;
  count: number;
  buyers: MarketBuyer[];
};

const MIN_COMPARABLES = 3;
const YEAR_WINDOW = 3;
const MAX_BUYERS = 6;

function fold(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function requiredTokens(make: string, model: string): string[] {
  const phrase = fold(`${make} ${model}`);
  const parts = phrase.split(' ').filter((token) => token.length >= 3);
  if (parts.length > 0) return [...new Set(parts)];
  return phrase.length >= 2 ? [phrase] : [];
}

function haystack(vehicle: MarketComparable): string {
  return fold(`${vehicle.make ?? ''} ${vehicle.model ?? ''} ${vehicle.name}`);
}

function matchesName(vehicle: MarketComparable, tokens: readonly string[]): boolean {
  const text = haystack(vehicle);
  return tokens.every((token) => text.includes(token));
}

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return Math.round(((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2);
  }
  return sorted[mid] ?? 0;
}

function quartile(values: readonly number[], fraction: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.round((sorted.length - 1) * fraction)),
  );
  return sorted[index] ?? 0;
}

function advertised(vehicles: readonly MarketComparable[]): MarketComparable[] {
  return vehicles.filter((vehicle) => vehicle.priceKind == null && vehicle.price > 0);
}

export function estimateMarketPrice(
  query: MarketPriceQuery,
  vehicles: readonly MarketComparable[],
): MarketPriceEstimate {
  const currency = query.currency.trim().toUpperCase();
  const country = query.country.trim().toUpperCase();
  const tokens = requiredTokens(query.make, query.model);
  const empty: MarketPriceEstimate = {
    currency,
    amount: null,
    low: null,
    high: null,
    count: 0,
    buyers: [],
  };
  if (tokens.length === 0) return empty;

  const named = vehicles.filter(
    (vehicle) =>
      vehicle.price > 0 &&
      vehicle.currency.toUpperCase() === currency &&
      matchesName(vehicle, tokens),
  );
  const buyers = named
    .filter((vehicle) => vehicle.country.toUpperCase() === country)
    .reduce<MarketBuyer[]>((list, vehicle) => {
      if (list.some((buyer) => buyer.dealerId === vehicle.dealerId)) return list;
      if (list.length >= MAX_BUYERS) return list;
      list.push({
        dealerId: vehicle.dealerId,
        name: vehicle.dealerName,
        city: vehicle.dealerCity,
        sourceUrl: vehicle.sourceUrl,
      });
      return list;
    }, []);

  const priced = advertised(named);
  const inCountry = priced.filter((vehicle) => vehicle.country.toUpperCase() === country);
  let pool = inCountry.length >= MIN_COMPARABLES ? inCountry : priced;
  const year = query.year;
  if (year != null) {
    const near = pool.filter(
      (vehicle) => vehicle.year != null && Math.abs(vehicle.year - year) <= YEAR_WINDOW,
    );
    if (near.length >= MIN_COMPARABLES) pool = near;
  }
  if (pool.length < MIN_COMPARABLES) {
    return { ...empty, buyers };
  }

  const prices = pool.map((vehicle) => vehicle.price);
  return {
    currency,
    amount: median(prices),
    low: quartile(prices, 0.25),
    high: quartile(prices, 0.75),
    count: prices.length,
    buyers,
  };
}
