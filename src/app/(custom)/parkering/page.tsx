import type { Metadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';
import { ParkingCatalogue } from '@/components/custom/parking-catalogue';
import { orderCatalogue } from '@/lib/discovery/catalogue-rank-store';
import {
  listParking,
  parkingCities,
  parkingCountries,
  parkingFiltersFromSearch,
} from '@/lib/discovery/parking';
import { absoluteUrl, publicAlternatesFor } from '@/lib/seo/alternates';
import { localePath } from '@/lib/seo/locale-path';
import { siteName } from '@/lib/site';

export const dynamic = 'force-dynamic';

type Props = {
  searchParams: Promise<{ country?: string; city?: string }>;
};

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('parkingPage.meta');
  const title = t('title');
  const description = t('description');
  const locale = await getLocale();
  return {
    title,
    description,
    alternates: await publicAlternatesFor('/parkering'),
    openGraph: {
      type: 'website',
      siteName,
      title: `${title} · ${siteName}`,
      description,
      url: absoluteUrl(localePath(locale, '/parkering')),
    },
  };
}

export default async function ParkingPage({ searchParams }: Props) {
  const params = await searchParams;
  const filters = parkingFiltersFromSearch(params);
  const rows = await orderCatalogue('parking', listParking(filters), (row) => ({
    id: row.id,
    currency: row.currency,
    amount: row.amount,
    country: row.country,
    checkedAt: row.checkedAt,
  }));
  return (
    <ParkingCatalogue
      filters={filters}
      rows={rows}
      countries={parkingCountries()}
      cities={parkingCities(filters.country)}
    />
  );
}
