import dataset from '../../../data/dealerships/dealerships.json';
import markets from '../../../data/dealerships/published-markets.json';

export type DealershipVehicleKind = 'car' | 'van' | 'heavy' | 'motorcycle' | 'other';
export type VehicleCondition = 'new' | 'used';
export type VehiclePriceKind = 'msrp' | 'from';

export type DealershipVehicle = {
  name: string;
  make: string | null;
  model: string | null;
  kind: DealershipVehicleKind;
  condition: VehicleCondition | null;
  price: number;
  currency: string;
  priceKind: VehiclePriceKind | null;
  sourceUrl: string;
  year: number | null;
  mileage: number | null;
  mileageUnit: 'mil' | 'km' | null;
  fuel: string | null;
  gearbox: string | null;
  power: string | null;
  color: string | null;
  imageUrl: string | null;
};

export type Dealership = {
  id: string;
  country: string;
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

const KINDS = new Set<DealershipVehicleKind>(['car', 'van', 'heavy', 'motorcycle', 'other']);
const CURRENCY_ORDER: Record<string, number> = {
  SEK: 0,
  NOK: 1,
  DKK: 2,
  EUR: 3,
  USD: 4,
  CAD: 5,
  GBP: 6,
  INR: 7,
};

function httpUrl(value: unknown): string | null {
  return typeof value === 'string' && /^https?:\/\/\S+$/i.test(value.trim()) ? value.trim() : null;
}

function shortText(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, 40) : null;
}

function modelYear(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1980 && value <= 2035
    ? value
    : null;
}

function mileageValue(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value < 2_000_000
    ? value
    : null;
}

function asDealership(row: unknown): Dealership | null {
  if (!row || typeof row !== 'object') return null;
  const record = row as Record<string, unknown>;
  const id = typeof record.id === 'string' ? record.id.trim() : '';
  const name = typeof record.name === 'string' ? record.name.trim() : '';
  const country = typeof record.country === 'string' ? record.country.trim().toUpperCase() : '';
  if (!id || !name || !/^[A-Z]{2}$/.test(country)) return null;
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
        const mileageUnit: 'mil' | 'km' | null =
          item.mileageUnit === 'mil' || item.mileageUnit === 'km' ? item.mileageUnit : null;
        const condition: VehicleCondition | null =
          item.condition === 'new' || item.condition === 'used' ? item.condition : null;
        const priceKind: VehiclePriceKind | null =
          item.priceKind === 'msrp' || item.priceKind === 'from' ? item.priceKind : null;
        return [
          {
            name: vehicleName,
            make: shortText(item.make),
            model: shortText(item.model),
            kind: kind as DealershipVehicleKind,
            condition,
            price,
            currency,
            priceKind,
            sourceUrl,
            year: modelYear(item.year),
            mileage: mileageValue(item.mileage),
            mileageUnit,
            fuel: shortText(item.fuel),
            gearbox: shortText(item.gearbox),
            power: shortText(item.power),
            color: shortText(item.color),
            imageUrl: httpUrl(item.imageUrl),
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

function dealerRows(file: unknown): unknown[] {
  if (!file || typeof file !== 'object' || !('dealers' in file)) return [];
  const rows = file.dealers;
  return Array.isArray(rows) ? rows : [];
}

const dealers = [...dealerRows(dataset), ...dealerRows(markets)]
  .map(asDealership)
  .filter((dealer): dealer is Dealership => dealer !== null);

export function listDealerships(): Dealership[] {
  return dealers;
}

export function dealerCountries(): Dealership['country'][] {
  return [...new Set(dealers.map((dealer) => dealer.country))].sort();
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

export type PublishedCar = {
  id: string;
  dealerId: string;
  dealerName: string;
  dealerCity: string;
  dealerCountry: Dealership['country'];
  vehicle: DealershipVehicle;
};

export function isSpecifiedVehicle(vehicle: DealershipVehicle): boolean {
  return (
    vehicle.priceKind != null ||
    vehicle.year != null ||
    vehicle.mileage != null ||
    Boolean(vehicle.fuel || vehicle.gearbox)
  );
}

export function publishedCars(rows: Dealership[] = dealers): PublishedCar[] {
  const cars: PublishedCar[] = [];
  for (const dealer of rows) {
    for (const vehicle of dealer.vehicles) {
      if (!isSpecifiedVehicle(vehicle)) continue;
      cars.push({
        id: `${dealer.id}:${vehicle.sourceUrl}:${vehicle.name}:${vehicle.price}`,
        dealerId: dealer.id,
        dealerName: dealer.name,
        dealerCity: dealer.city,
        dealerCountry: dealer.country,
        vehicle,
      });
    }
  }
  cars.sort(
    (left, right) =>
      compareMoney(left.vehicle, right.vehicle) ||
      left.vehicle.name.localeCompare(right.vehicle.name, 'sv'),
  );
  return cars;
}

function currencyRank(currency: string): number {
  return CURRENCY_ORDER[currency] ?? 50;
}

function compareMoney(
  left: Pick<DealershipVehicle, 'price' | 'currency'>,
  right: Pick<DealershipVehicle, 'price' | 'currency'>,
): number {
  const rank = currencyRank(left.currency) - currencyRank(right.currency);
  if (rank !== 0) return rank;
  if (left.currency !== right.currency) return left.currency.localeCompare(right.currency);
  return left.price - right.price;
}

export type VehicleSearch = {
  q?: string;
  city?: string;
  country?: string;
  kind?: string;
  condition?: string;
};

function fold(value: string): string {
  return value.trim().toLocaleLowerCase();
}

/** Published vehicles for a model and place. A place matches the dealer's city only. */
export function searchPublishedCars(
  query: VehicleSearch,
  rows: Dealership[] = dealers,
): PublishedCar[] {
  const words = fold(query.q ?? '')
    .split(/\s+/)
    .filter(Boolean);
  const city = fold(query.city ?? '');
  const country = query.country?.trim().toUpperCase() ?? '';
  const kind = KINDS.has(query.kind as DealershipVehicleKind)
    ? (query.kind as DealershipVehicleKind)
    : null;
  const condition =
    query.condition === 'new' || query.condition === 'used' ? query.condition : null;
  return publishedCars(rows).filter((car) => {
    if (country && car.dealerCountry !== country) return false;
    if (kind && car.vehicle.kind !== kind) return false;
    if (condition && car.vehicle.condition !== condition) return false;
    if (city && !fold(car.dealerCity).includes(city)) return false;
    if (words.length === 0) return true;
    const haystack = fold(
      `${car.vehicle.make ?? ''} ${car.vehicle.model ?? ''} ${car.vehicle.name} ${car.dealerName}`,
    );
    return words.every((word) => haystack.includes(word));
  });
}

export function dealersForCars(cars: PublishedCar[]): Array<{
  id: string;
  name: string;
  city: string;
  country: string;
  cars: PublishedCar[];
}> {
  const groups: Array<{
    id: string;
    name: string;
    city: string;
    country: string;
    cars: PublishedCar[];
  }> = [];
  for (const car of cars) {
    const existing = groups.find((group) => group.id === car.dealerId);
    if (existing) existing.cars.push(car);
    else
      groups.push({
        id: car.dealerId,
        name: car.dealerName,
        city: car.dealerCity,
        country: car.dealerCountry,
        cars: [car],
      });
  }
  return groups;
}

export function compareDealerships(a: Dealership, b: Dealership): number {
  const left = cheapestVehicle(a);
  const right = cheapestVehicle(b);
  if (!left && !right) return a.name.localeCompare(b.name, 'sv');
  if (!left) return 1;
  if (!right) return -1;
  return compareMoney(left, right) || a.name.localeCompare(b.name, 'sv');
}
