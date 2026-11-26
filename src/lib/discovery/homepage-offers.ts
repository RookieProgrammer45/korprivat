/**
 * Homepage preview rows for cars and parts.
 * One currency per grid. A thin local catalogue falls back to the Swedish rows
 * rather than mixing SEK with another currency in the same list.
 */

const FILL = 8;

const CAR_CURRENCY: Record<string, string> = {
  au: 'AUD',
  us: 'USD',
  ca: 'CAD',
  gb: 'GBP',
  no: 'NOK',
  dk: 'DKK',
  se: 'SEK',
};

const EURO = new Set([
  'at',
  'be',
  'cy',
  'de',
  'ee',
  'es',
  'fi',
  'fr',
  'gr',
  'hr',
  'ie',
  'it',
  'lt',
  'lu',
  'lv',
  'mt',
  'nl',
  'pt',
  'si',
  'sk',
]);

type CarRow = { vehicle: { currency: string; kind?: string; name?: string } };

const NOT_A_ROAD_CAR = /ski-doo|snöskoter|snowmobile|\batv\b|fyrhjuling|linhai/i;

type PartRow = {
  price: number;
  currency: string;
  sellerCountry: string;
  buyers: readonly string[];
  kind?: string;
  text?: string;
};

const MOTORCYCLE_TEXT =
  /kawasaki|ducati|harley|piaggio|kymco|motorcykel|moottoripyörä|hyosung|aprilia|keeway|baotian|betamotor|can-am|cf moto|ski-doo/i;

export function preferredCarCurrency(countryCode: string): string {
  const code = countryCode.toLowerCase();
  if (CAR_CURRENCY[code]) return CAR_CURRENCY[code];
  if (EURO.has(code)) return 'EUR';
  return 'SEK';
}

/** Seller country whose published parts we can show. Euro visitors use the Finnish EUR catalogue. */
export function preferredPartCountry(countryCode: string): string {
  const code = countryCode.toLowerCase();
  if (code === 'au') return 'AU';
  if (code === 'us') return 'US';
  if (EURO.has(code)) return 'FI';
  return 'SE';
}

export function pickHomepageCars<T extends CarRow>(
  cars: readonly T[],
  countryCode: string,
  limit = 20,
): T[] {
  const preferred = preferredCarCurrency(countryCode);
  const road = cars.filter((car) => {
    if (car.vehicle.name && NOT_A_ROAD_CAR.test(car.vehicle.name)) return false;
    return !car.vehicle.kind || car.vehicle.kind === 'car' || car.vehicle.kind === 'van';
  });
  const pool = road.length >= FILL ? road : cars;
  const inPreferred = pool.filter((car) => car.vehicle.currency === preferred);
  const chosen =
    inPreferred.length >= FILL || preferred === 'SEK'
      ? inPreferred
      : pool.filter((car) => car.vehicle.currency === 'SEK');
  const rows = chosen.length > 0 ? chosen : inPreferred;
  return rows.slice(0, limit);
}

function carCataloguePart(part: PartRow): boolean {
  if (part.kind && part.kind !== 'part') return false;
  if (part.text && MOTORCYCLE_TEXT.test(part.text)) return false;
  return part.buyers.includes('owner') || part.buyers.includes('workshop');
}

function mainCurrency<T extends PartRow>(rows: readonly T[]): T[] {
  const counts = new Map<string, number>();
  for (const row of rows) counts.set(row.currency, (counts.get(row.currency) ?? 0) + 1);
  let currency = '';
  let best = -1;
  for (const [code, count] of counts) {
    if (count > best) {
      currency = code;
      best = count;
    }
  }
  return rows
    .filter((row) => row.currency === currency)
    .slice()
    .sort((left, right) => left.price - right.price);
}

export function pickHomepageParts<T extends PartRow>(
  parts: readonly T[],
  countryCode: string,
  limit = 20,
): T[] {
  const catalogue = parts.filter(carCataloguePart);
  const country = preferredPartCountry(countryCode);
  const inCountry = catalogue.filter((part) => part.sellerCountry === country);
  const pool =
    inCountry.length >= FILL || country === 'SE'
      ? inCountry
      : catalogue.filter((part) => part.sellerCountry === 'SE');
  const rows = pool.length > 0 ? pool : inCountry;
  return mainCurrency(rows).slice(0, limit);
}
