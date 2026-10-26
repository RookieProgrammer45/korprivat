// Published B prices from data/school-prices (see its README). These are
// reference data read off each school's website: display only, always
// labelled with the collection date and source, never a booking amount.
import 'server-only';
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
};

const MAX_PACKAGES = 6;

const byListing = new Map<string, PublishedPrices>();
for (const school of dataset.schools as DatasetSchool[]) {
  if (school.status !== 'OK' || school.listingIds.length === 0) continue;
  const packages: PublishedPackage[] = [
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
    lesson: school.lesson.priceSek
      ? { priceSek: school.lesson.priceSek, minutes: school.lesson.minutes }
      : null,
    risk1Sek: school.risk1Sek || null,
    risk2Sek: school.risk2Sek || null,
    packages,
    sourceUrl: school.sourceUrl,
    collectedAt: school.checkedAt ?? dataset.meta.collectedAt,
  };
  if (!prices.lesson && !prices.risk1Sek && !prices.risk2Sek && packages.length === 0) continue;
  for (const listingId of school.listingIds) byListing.set(listingId, prices);
}

// Public pages show the website lesson price over the listing's stored rate;
// the stored rate stays untouched for a future checkout.
export function publishedPrices(listingId: string): PublishedPrices | null {
  return byListing.get(listingId) ?? null;
}
