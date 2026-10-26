// Published B and heavy-vehicle prices from data/school-prices (see its
// README). These are reference data read off each school's website: display
// only, always labelled with the collection date and source, never a booking
// amount.
import 'server-only';
import type { HeavyFilter, HeavyLicenceCode } from '@/lib/business/licence-categories';
import dataset from '../../../data/school-prices/school-prices.json';

export type PublishedPackage = {
  name: string;
  kind: 'package' | 'intensive';
  lessons: number | null;
  priceSek: number;
};

export type PublishedPrices = {
  lesson: { priceSek: number; minutes: number | null } | null;
  risk1Sek: number | null;
  risk2Sek: number | null;
  packages: PublishedPackage[];
  sourceUrl: string | null;
  collectedAt: string;
  heavy: PublishedHeavy | null;
};

export type PublishedHeavyPrice = {
  category: HeavyLicenceCode | 'YKB';
  kind: 'lesson' | 'course';
  name: string;
  minutes: number | null;
  hours: number | null;
  priceSek: number;
};

export type PublishedHeavy = {
  categories: HeavyLicenceCode[];
  ykb: boolean;
  prices: PublishedHeavyPrice[];
  sourceUrl: string | null;
  collectedAt: string;
};

type DatasetSchool = {
  listingIds: string[];
  status: string;
  sourceUrl: string | null;
  checkedAt?: string;
  lesson: { priceSek: number | null; minutes: number | null };
  risk1Sek: number | null;
  risk2Sek: number | null;
  packages?: Array<{ name: string; lessons: number | null; priceSek: number }>;
  intensive: { courses: Array<{ name: string; priceSek: number | null }> };
  heavy?: {
    categories: HeavyLicenceCode[];
    ykb: boolean;
    prices: Array<{
      category: HeavyLicenceCode | 'YKB';
      kind: 'LESSON' | 'COURSE';
      name: string;
      minutes: number | null;
      hours: number | null;
      priceSek: number;
    }>;
    sourceUrl: string | null;
    checkedAt: string;
  } | null;
};

const MAX_PACKAGES = 6;
const HEAVY_ORDER = ['C1', 'C1E', 'C', 'CE', 'D1', 'D1E', 'D', 'DE', 'YKB'];

function toHeavy(school: DatasetSchool): PublishedHeavy | null {
  if (!school.heavy) return null;
  return {
    categories: school.heavy.categories,
    ykb: school.heavy.ykb,
    prices: school.heavy.prices
      .map((price) => ({
        category: price.category,
        kind: price.kind === 'LESSON' ? ('lesson' as const) : ('course' as const),
        name: price.name,
        minutes: price.minutes,
        hours: price.hours,
        priceSek: price.priceSek,
      }))
      .sort(
        (a, b) =>
          HEAVY_ORDER.indexOf(a.category) - HEAVY_ORDER.indexOf(b.category) ||
          a.priceSek - b.priceSek,
      ),
    sourceUrl: school.heavy.sourceUrl,
    collectedAt: school.heavy.checkedAt,
  };
}

const byListing = new Map<string, PublishedPrices>();
for (const school of dataset.schools as DatasetSchool[]) {
  if (school.listingIds.length === 0) continue;
  const heavy = toHeavy(school);
  const hasB = school.status === 'OK';
  const packages: PublishedPackage[] = !hasB
    ? []
    : [
        // A package bundles at least two driving lessons; theory-only or
        // risk-only bundles would otherwise top a "cheapest package" sort.
        ...(school.packages ?? [])
          .filter(
            (pack) =>
              (pack.lessons ?? 0) >= 2 && !(/teori/i.test(pack.name) && !/kör/i.test(pack.name)),
          )
          .map((pack) => ({
            name: pack.name,
            kind: 'package' as const,
            lessons: pack.lessons,
            priceSek: pack.priceSek,
          })),
        ...school.intensive.courses.flatMap((course) =>
          course.priceSek
            ? [
                {
                  name: course.name,
                  kind: 'intensive' as const,
                  lessons: null,
                  priceSek: course.priceSek,
                },
              ]
            : [],
        ),
      ]
        .filter(
          (pack, index, all) =>
            all.findIndex(
              (other) =>
                other.priceSek === pack.priceSek &&
                other.name.trim().toLowerCase() === pack.name.trim().toLowerCase(),
            ) === index,
        )
        .sort((a, b) => a.priceSek - b.priceSek)
        .slice(0, MAX_PACKAGES);
  const prices: PublishedPrices = {
    lesson:
      hasB && school.lesson.priceSek
        ? { priceSek: school.lesson.priceSek, minutes: school.lesson.minutes }
        : null,
    risk1Sek: (hasB && school.risk1Sek) || null,
    risk2Sek: (hasB && school.risk2Sek) || null,
    packages,
    sourceUrl: school.sourceUrl,
    collectedAt: school.checkedAt ?? dataset.meta.collectedAt,
    heavy,
  };
  const hasBPrice = Boolean(prices.lesson || prices.risk1Sek || prices.risk2Sek || packages.length);
  const hasHeavyPrice = (heavy?.prices.length ?? 0) > 0;
  if (!hasBPrice && !hasHeavyPrice) continue;
  for (const listingId of school.listingIds) byListing.set(listingId, prices);
}

const HEAVY_FILTER_CODES: Record<HeavyFilter, ReadonlyArray<string>> = {
  truck: ['C1', 'C1E', 'C', 'CE'],
  bus: ['D1', 'D1E', 'D', 'DE'],
  ykb: [],
};

function offersHeavy(prices: PublishedPrices, filter: HeavyFilter): boolean {
  if (!prices.heavy) return false;
  if (filter === 'ykb') return prices.heavy.ykb;
  return prices.heavy.categories.some((code) => HEAVY_FILTER_CODES[filter].includes(code));
}

const heavyIds = Object.fromEntries(
  (['truck', 'bus', 'ykb'] as const).map((filter) => [
    filter,
    [...byListing].flatMap(([id, prices]) => (offersHeavy(prices, filter) ? [id] : [])),
  ]),
) as Record<HeavyFilter, string[]>;

export function heavyListingWhere(filter: HeavyFilter): { id: { in: string[] } } {
  return { id: { in: heavyIds[filter] } };
}

// Public pages show the website lesson price over the listing's stored rate;
// the stored rate stays untouched for a future checkout.
export function publishedPrices(listingId: string): PublishedPrices | null {
  return byListing.get(listingId) ?? null;
}

// Only schools with at least one price on their own website are listed
// publicly; the rest stay in the database but off every public surface.
export function hasPublishedPrices(listingId: string): boolean {
  return byListing.has(listingId);
}

const listedIds = [...byListing.keys()];

export function publishedListingWhere(): { id: { in: string[] } } {
  return { id: { in: listedIds } };
}
