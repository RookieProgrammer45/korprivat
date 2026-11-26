import dataset from '../../../data/parts/products.json';

export type PartKind = 'part' | 'motorcycle' | 'accessory';

export type PartStore = {
  name: string;
  address: string;
  city: string;
  region: string | null;
  country: string;
  latitude: number;
  longitude: number;
};

export type ListedPart = {
  id: string;
  name: string;
  brand: string | null;
  kind: PartKind;
  category: string | null;
  price: number;
  currency: string;
  specs: string[];
  imageUrl: string | null;
  sourceUrl: string;
  sellerName: string;
  sellerCountry: string;
  checkedAt: string;
  stores: PartStore[];
  /** owner: a driver with a car licence. workshop: a mechanic ordering for a client. rider: motorcycle gear. */
  buyers: Array<'owner' | 'workshop' | 'rider'>;
};

export type PartMatch = ListedPart & {
  nearestStore: PartStore | null;
  nearestKm: number | null;
};

const KINDS = new Set<PartKind>(['part', 'motorcycle', 'accessory']);
const CURRENCY_ORDER: Record<string, number> = {
  SEK: 0,
  NOK: 1,
  DKK: 2,
  EUR: 3,
  USD: 4,
  AUD: 5,
};

function httpUrl(value: unknown): string | null {
  return typeof value === 'string' && /^https?:\/\/\S+$/i.test(value.trim()) ? value.trim() : null;
}

function shortText(value: unknown, limit: number): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, limit) : null;
}

/** A published amount: whole units, or units with at most two decimal places. */
function publishedPrice(price: unknown): number | null {
  if (typeof price !== 'number' || !Number.isFinite(price) || price <= 0) return null;
  const cents = Math.round(price * 100);
  if (Math.abs(price * 100 - cents) > 1e-6) return null;
  return cents / 100;
}

function asPart(row: unknown): ListedPart | null {
  if (!row || typeof row !== 'object') return null;
  const item = row as Record<string, unknown>;
  const id = typeof item.id === 'string' ? item.id.trim() : '';
  const name = shortText(item.name, 120);
  const kind = item.kind;
  const price = item.price;
  const currency = typeof item.currency === 'string' ? item.currency.trim().toUpperCase() : '';
  const sourceUrl = httpUrl(item.sourceUrl);
  const sellerName = shortText(item.sellerName, 80);
  const sellerCountry =
    typeof item.sellerCountry === 'string' ? item.sellerCountry.trim().toUpperCase() : '';
  const specs = Array.isArray(item.specs)
    ? item.specs.flatMap((spec) => {
        const text = shortText(spec, 160);
        return text ? [text] : [];
      })
    : [];
  const amount = publishedPrice(price);
  if (!id || !name || !KINDS.has(kind as PartKind) || amount == null) return null;
  if (!currency || !sourceUrl || !sellerName || !/^[A-Z]{2}$/.test(sellerCountry)) return null;
  if (specs.length === 0) return null;
  const buyers = Array.isArray(item.buyers)
    ? item.buyers.flatMap((buyer) =>
        buyer === 'owner' || buyer === 'workshop' || buyer === 'rider' ? [buyer] : [],
      )
    : (['owner', 'workshop'] as Array<'owner' | 'workshop' | 'rider'>);
  return {
    id,
    name,
    brand: shortText(item.brand, 40),
    kind: kind as PartKind,
    category: shortText(item.category, 60),
    price: amount,
    currency,
    specs: specs.slice(0, 16),
    stores: storesFrom(item.stores),
    imageUrl: httpUrl(item.imageUrl),
    sourceUrl,
    sellerName,
    sellerCountry,
    checkedAt: typeof item.checkedAt === 'string' ? item.checkedAt : '',
    buyers,
  };
}

function coordinate(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function storesFrom(value: unknown): PartStore[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== 'object') return [];
    const store = entry as Record<string, unknown>;
    const name = shortText(store.name, 80);
    const address = shortText(store.address, 120);
    const city = shortText(store.city, 80);
    const country = typeof store.country === 'string' ? store.country.trim().toUpperCase() : '';
    const latitude = coordinate(store.latitude);
    const longitude = coordinate(store.longitude);
    if (
      !name ||
      !address ||
      !city ||
      !/^[A-Z]{2}$/.test(country) ||
      latitude == null ||
      longitude == null
    ) {
      return [];
    }
    return [
      {
        name,
        address,
        city,
        region: shortText(store.region, 40),
        country,
        latitude,
        longitude,
      },
    ];
  });
}

function rows(file: unknown): ListedPart[] {
  const products =
    file && typeof file === 'object' ? (file as { products?: unknown }).products : null;
  return Array.isArray(products)
    ? products.flatMap((row) => {
        const part = asPart(row);
        return part ? [part] : [];
      })
    : [];
}

const parts = rows(dataset);

export function listParts(): readonly ListedPart[] {
  return parts;
}

export function partSellerCountries(): string[] {
  return [...new Set(parts.map((part) => part.sellerCountry))].sort();
}

function currencyRank(currency: string): number {
  return CURRENCY_ORDER[currency] ?? 50;
}

function compareMoney(left: ListedPart, right: ListedPart): number {
  const rank = currencyRank(left.currency) - currencyRank(right.currency);
  if (rank !== 0) return rank;
  if (left.currency !== right.currency) return left.currency.localeCompare(right.currency);
  return left.price - right.price;
}

export type PartSearch = {
  q?: string;
  kind?: string;
  place?: string;
  lat?: number;
  lng?: number;
  /** Car owner (B/BE) or a workshop ordering a part for a client. */
  buyer?: string;
  /** ISO-2 country of the shop that published the price. */
  country?: string;
};

/** OpenStreetMap location of "New York, NY". Used only to measure distance. */
const PLACE_CENTERS = [
  { names: ['new york', 'new york ny', 'nyc'], latitude: 40.7127281, longitude: -74.0060152 },
];
const NEAR_KM = 120;
const SAME_WORD = [['helmet', 'hjälm', 'hjelm', 'kypärä']];

function fold(value: string): string {
  return value.trim().toLocaleLowerCase().replace(/\s+/g, ' ');
}

function kmBetween(fromLat: number, fromLng: number, toLat: number, toLng: number): number {
  const earthKm = 6371;
  const lat1 = (fromLat * Math.PI) / 180;
  const lat2 = (toLat * Math.PI) / 180;
  const dLat = ((toLat - fromLat) * Math.PI) / 180;
  const dLng = ((toLng - fromLng) * Math.PI) / 180;
  const arc = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * earthKm * Math.asin(Math.min(1, Math.sqrt(arc)));
}

function originOf(query: PartSearch): { latitude: number; longitude: number } | null {
  if (
    typeof query.lat === 'number' &&
    typeof query.lng === 'number' &&
    Number.isFinite(query.lat) &&
    Number.isFinite(query.lng) &&
    query.lat >= -90 &&
    query.lat <= 90 &&
    query.lng >= -180 &&
    query.lng <= 180
  ) {
    return { latitude: query.lat, longitude: query.lng };
  }
  return query.place ? placeCenter(query.place) : null;
}

function wordMatches(word: string, haystack: string): boolean {
  const group = SAME_WORD.find((words) => words.includes(word));
  return (group ?? [word]).some((needle) => haystack.includes(needle));
}

function placeCenter(place: string): { latitude: number; longitude: number } | null {
  const key = fold(place);
  return PLACE_CENTERS.find((entry) => entry.names.includes(key)) ?? null;
}

function nearestStore(
  part: ListedPart,
  place: string,
  origin: { latitude: number; longitude: number } | null,
): { store: PartStore; km: number | null } | null {
  const wanted = fold(place);
  let best: { store: PartStore; km: number | null } | null = null;
  for (const store of part.stores) {
    const city = fold(store.city);
    const cityRegion = fold(`${store.city} ${store.region ?? ''}`);
    const km = origin
      ? kmBetween(origin.latitude, origin.longitude, store.latitude, store.longitude)
      : null;
    const named = wanted.length > 0 && (city === wanted || cityRegion === wanted);
    const near = km != null && km <= NEAR_KM;
    if (!named && !near) continue;
    const distance = km ?? Number.POSITIVE_INFINITY;
    if (!best || distance < (best.km ?? Number.POSITIVE_INFINITY)) best = { store, km };
  }
  return best;
}

/** Products whose seller page published a price and at least one specification. */
export function searchParts(
  query: PartSearch,
  rowsToSearch: readonly ListedPart[] = parts,
): PartMatch[] {
  const words = fold(query.q ?? '')
    .split(/\s+/)
    .filter(Boolean);
  const kind = KINDS.has(query.kind as PartKind) ? (query.kind as PartKind) : null;
  const place = query.place?.trim() ?? '';
  const origin = originOf(query);
  const located = place.length > 0 || origin != null;
  const buyer = query.buyer === 'owner' || query.buyer === 'workshop' ? query.buyer : null;
  const country =
    typeof query.country === 'string' && /^[A-Za-z]{2}$/.test(query.country.trim())
      ? query.country.trim().toUpperCase()
      : null;
  return rowsToSearch
    .flatMap((part) => {
      if (kind && part.kind !== kind) return [];
      if (buyer && !part.buyers.includes(buyer)) return [];
      if (country && part.sellerCountry !== country) return [];
      if (words.length > 0) {
        const haystack = fold(
          `${part.brand ?? ''} ${part.name} ${part.category ?? ''} ${part.sellerName} ${part.specs.join(' ')}`,
        );
        if (!words.every((word) => wordMatches(word, haystack))) return [];
      }
      const near = located ? nearestStore(part, place, origin) : null;
      return [
        {
          ...part,
          nearestStore: near?.store ?? null,
          nearestKm: near?.km ?? null,
        },
      ];
    })
    .sort((left, right) => {
      if (located) {
        const leftNear = left.nearestStore ? 0 : 1;
        const rightNear = right.nearestStore ? 0 : 1;
        if (leftNear !== rightNear) return leftNear - rightNear;
        if (
          left.nearestKm != null &&
          right.nearestKm != null &&
          left.nearestKm !== right.nearestKm
        ) {
          return left.nearestKm - right.nearestKm;
        }
      }
      return compareMoney(left, right);
    });
}
