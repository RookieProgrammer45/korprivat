//
// Frontstage: the price, then the schools. Policy stays on the terms page.
// Server component so the three schools are in the first HTML response.

// biome-ignore lint/style/noRestrictedImports: server component - reads the Vercel geo headers to order schools by region
import { headers } from 'next/headers';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { HomeCatalogue, type HomeOfferCard } from '@/components/custom/home-catalogue';
import { HOMEPAGE_SCHOOL_PREVIEW_LIMIT } from '@/lib/catalog-preview';
import { orderCatalogue } from '@/lib/discovery/catalogue-rank-store';
import {
  cheapestVehicle,
  dealerCities,
  listDealerships,
  type PublishedCar,
  publishedCars,
} from '@/lib/discovery/dealerships';
import { pickHomepageCars, pickHomepageParts } from '@/lib/discovery/homepage-offers';
import { listHomepageSchools } from '@/lib/discovery/homepage-schools';
import { type ListedPart, listParts } from '@/lib/discovery/parts';
import { publishedLessonSek } from '@/lib/discovery/published-lesson-order';
import { visitorCatalogueRegionFromHeaders } from '@/lib/discovery/visitor-catalogue-region';
import { absoluteUrl } from '@/lib/seo/alternates';
import { dealerSearchPath } from '@/lib/seo/dealer-search-path';
import { jsonLdScript } from '@/lib/seo/json-ld';
import { partsSearchPath } from '@/lib/seo/parts-search-path';
import { parseHeroSearchCategory } from '@/lib/seo/school-search-path';
import { schoolPath } from '@/lib/seo/school-slugs';

export async function PublicHome({ category }: { category?: string | null } = {}) {
  const t = await getTranslations('publicHome');
  const headerStore = await headers();
  const region = visitorCatalogueRegionFromHeaders((name) => headerStore.get(name));
  const listed = await listHomepageSchools(HOMEPAGE_SCHOOL_PREVIEW_LIMIT, region, category).catch(
    () => undefined,
  );
  const schools = listed
    ? await orderCatalogue('school', listed, (school) => ({
        id: school.id,
        currency: 'SEK',
        amount: publishedLessonSek(school),
        country: 'SE',
        checkedAt: null,
      }))
    : undefined;
  const licence = parseHeroSearchCategory(category);
  const filtered = Boolean(licence && licence !== 'B');
  const itemList =
    schools && schools.length > 0
      ? {
          '@context': 'https://schema.org',
          '@type': 'ItemList',
          name: t('providers.title'),
          numberOfItems: schools.length,
          itemListElement: schools.map((school, index) => ({
            '@type': 'ListItem',
            position: index + 1,
            name: school.name,
            url: absoluteUrl(schoolPath(school)),
          })),
        }
      : null;

  return (
    <main className="marketplace-home relative isolate w-full min-w-0">
      {itemList ? jsonLdScript(itemList) : null}
      <HomeCatalogue
        schools={schools}
        cars={await previewCars(region.countryCode)}
        parts={await previewParts(region.countryCode)}
        dealerCities={dealerCities()}
        lessonFrom={lowestLessonSek(schools)}
        vehicleFrom={lowestVehicle()}
        schoolsEmptyLabel={filtered ? t('providers.filteredEmpty') : undefined}
      />

      <section className="border-t border-border">
        <div className="container-page flex min-w-0 flex-col items-start gap-4 py-12 lg:py-16 sm:flex-row sm:items-center">
          <Link href="/locations" className="dlu-ink-pill">
            {t('entry.learnerCta')}
          </Link>
          <Link href="/for-skolor" className="dlu-text-link">
            {t('entry.providerCta')}
          </Link>
          <Link href="/contact?topic=list_dealer" className="dlu-text-link">
            {t('entry.dealerCta')}
          </Link>
          <Link href="/reservdelar" className="dlu-text-link">
            {t('entry.partsCta')}
          </Link>
        </div>
      </section>
    </main>
  );
}

async function previewCars(countryCode: string): Promise<HomeOfferCard[]> {
  const picked = pickHomepageCars(publishedCars(), countryCode, HOMEPAGE_SCHOOL_PREVIEW_LIMIT);
  const ranked = await orderCatalogue('car', picked, (car) => ({
    id: car.id,
    currency: car.vehicle.currency,
    amount: car.vehicle.price,
    country: car.dealerCountry,
    checkedAt: null,
  }));
  return ranked.map(carCard);
}

async function previewParts(countryCode: string): Promise<HomeOfferCard[]> {
  const rows = listParts().map((part) => ({
    ...part,
    text: `${part.name} ${part.category ?? ''} ${part.specs.join(' ')}`,
  }));
  const picked = pickHomepageParts(rows, countryCode, HOMEPAGE_SCHOOL_PREVIEW_LIMIT);
  const ranked = await orderCatalogue('part', picked, (part) => ({
    id: part.id,
    currency: part.currency,
    amount: part.price,
    country: part.sellerCountry,
    checkedAt: part.checkedAt || null,
  }));
  return ranked.map(partCard);
}

function carCard(car: PublishedCar): HomeOfferCard {
  const spec = [car.vehicle.year, car.vehicle.fuel, car.vehicle.gearbox].find(
    (value) => value != null && String(value).length > 0,
  );
  return {
    id: car.id,
    learn: 'car',
    href: dealerSearchPath(car.dealerCity, car.vehicle.kind, car.vehicle.model ?? car.vehicle.name),
    place: car.dealerCity,
    name: car.vehicle.name,
    price: car.vehicle.price,
    currency: car.vehicle.currency,
    imageUrl: httpsImage(car.vehicle.imageUrl),
    spec: spec == null ? null : String(spec),
  };
}

function partCard(part: ListedPart): HomeOfferCard {
  return {
    id: part.id,
    learn: 'part',
    href: partsSearchPath(part.name),
    place: part.sellerName,
    name: part.name,
    price: part.price,
    currency: part.currency,
    imageUrl: httpsImage(part.imageUrl),
    spec: part.specs[0] ?? null,
  };
}

function httpsImage(url: string | null): string | null {
  return url && /^https:\/\//i.test(url) ? url : null;
}

function lowestLessonSek(
  schools: Awaited<ReturnType<typeof listHomepageSchools>> | undefined,
): number | null {
  const prices = (schools ?? [])
    .map((school) => school.publishedPrices?.lesson?.priceSek)
    .filter((price): price is number => typeof price === 'number' && price > 0);
  return prices.length > 0 ? Math.min(...prices) : null;
}

function lowestVehicle(): { amount: number; currency: string } | null {
  const specified = publishedCars().find((car) => car.vehicle.currency === 'SEK');
  if (specified) return { amount: specified.vehicle.price, currency: specified.vehicle.currency };
  const offers = listDealerships()
    .map(cheapestVehicle)
    .filter((vehicle): vehicle is NonNullable<typeof vehicle> => vehicle?.currency === 'SEK');
  const cheapest = offers.sort((a, b) => a.price - b.price)[0];
  return cheapest ? { amount: cheapest.price, currency: cheapest.currency } : null;
}
