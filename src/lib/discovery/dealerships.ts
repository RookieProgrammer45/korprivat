import dataset from '../../../data/dealerships/dealerships.json';

export type DealershipVehicleKind = 'car' | 'van' | 'heavy' | 'other';

export type DealershipVehicle = {
  name: string;
  kind: DealershipVehicleKind;
  price: number;
  currency: string;
  sourceUrl: string;
};

export type Dealership = {
  id: string;
  country: 'SE' | 'NO' | 'DK' | 'FI' | 'IS';
  name: string;
  city: string;
  address: string;
  website: string | null;
  phone: string | null;
  email: string | null;
  logoUrl: string | null;
  brands: string[];
  categories: string[];
  sourceUrl: string;
  sourceName: string;
  checkedAt: string;
  vehicles: DealershipVehicle[];
};

const KINDS = new Set<DealershipVehicleKind>(['car', 'van', 'heavy', 'other']);
const CURRENCY_ORDER: Record<string, number> = { SEK: 0, NOK: 1, DKK: 2, EUR: 3 };

function httpUrl(value: unknown): string | null {
  return typeof value === 'string' && /^https?:\/\/\S+$/i.test(value.trim()) ? value.trim() : null;
}

function asDealership(row: unknown): Dealership | null {
  if (!row || typeof row !== 'object') return null;
  const record = row as Record<string, unknown>;
  const id = typeof record.id === 'string' ? record.id.trim() : '';
  const name = typeof record.name === 'string' ? record.name.trim() : '';
  const country = record.country;
  if (!id || !name) return null;
  if (
    country !== 'SE' &&
    country !== 'NO' &&
    country !== 'DK' &&
    country !== 'FI' &&
    country !== 'IS'
  ) {
    return null;
  }
  const vehicles = Array.isArray(record.vehicles)
    ? record.vehicles.flatMap((vehicle) => {
        if (!vehicle || typeof vehicle !== 'object') return [];
        const item = vehicle as Record<string, unknown>;
        const kind = item.kind;
        const price = item.price;
        const currency =
          typeof item.currency === 'string' ? item.currency.trim().toUpperCase() : '';
        const sourceUrl = httpUrl(item.sourceUrl);
        const vehicleName = typeof item.name === 'string' ? item.name.trim() : '';
        if (!KINDS.has(kind as DealershipVehicleKind)) return [];
        if (typeof price !== 'number' || !Number.isFinite(price) || price <= 0) return [];
        if (!currency || !sourceUrl || !vehicleName) return [];
        return [
          {
            name: vehicleName,
            kind: kind as DealershipVehicleKind,
            price,
            currency,
            sourceUrl,
          },
        ];
      })
    : [];
  return {
    id,
    country,
    name,
    city: typeof record.city === 'string' ? record.city.trim() : '',
    address: typeof record.address === 'string' ? record.address : '',
    website: httpUrl(record.website),
    phone: typeof record.phone === 'string' && record.phone.trim() ? record.phone.trim() : null,
    email:
      typeof record.email === 'string' && record.email.includes('@') ? record.email.trim() : null,
    logoUrl: httpUrl(record.logoUrl),
    brands: Array.isArray(record.brands)
      ? record.brands.filter(
          (brand): brand is string => typeof brand === 'string' && brand.trim() !== '',
        )
      : [],
    categories: Array.isArray(record.categories)
      ? record.categories.filter((item): item is string => typeof item === 'string')
      : [],
    sourceUrl: httpUrl(record.sourceUrl) ?? '',
    sourceName: typeof record.sourceName === 'string' ? record.sourceName : '',
    checkedAt: typeof record.checkedAt === 'string' ? record.checkedAt : '',
    vehicles,
  };
}

const dealers = (Array.isArray(dataset.dealers) ? dataset.dealers : [])
  .map(asDealership)
  .filter((dealer): dealer is Dealership => dealer !== null);

export function listDealerships(): Dealership[] {
  return dealers;
}

export function dealerCities(): string[] {
  return [...new Set(dealers.map((dealer) => dealer.city).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, 'sv'),
  );
}

export function cheapestVehicle(dealer: Dealership): DealershipVehicle | null {
  return dealer.vehicles.reduce<DealershipVehicle | null>((best, vehicle) => {
    if (!best || vehicle.price < best.price) return vehicle;
    return best;
  }, null);
}

export function compareDealerships(a: Dealership, b: Dealership): number {
  const left = cheapestVehicle(a);
  const right = cheapestVehicle(b);
  if (!left && !right) return a.name.localeCompare(b.name, 'sv');
  if (!left) return 1;
  if (!right) return -1;
  const currency = (CURRENCY_ORDER[left.currency] ?? 9) - (CURRENCY_ORDER[right.currency] ?? 9);
  if (currency !== 0) return currency;
  if (left.price !== right.price) return left.price - right.price;
  return a.name.localeCompare(b.name, 'sv');
}
