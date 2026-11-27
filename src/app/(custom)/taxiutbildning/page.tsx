import type { Metadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';
import { TaxiCatalogue } from '@/components/custom/taxi-catalogue';
import { orderCatalogue } from '@/lib/discovery/catalogue-rank-store';
import {
  listTaxiTraining,
  taxiCountries,
  taxiFiltersFromSearch,
} from '@/lib/discovery/taxi-training';
import { absoluteUrl, publicAlternatesFor } from '@/lib/seo/alternates';
import { localePath } from '@/lib/seo/locale-path';
import { siteName } from '@/lib/site';

export const dynamic = 'force-dynamic';

type Props = {
  searchParams: Promise<{ country?: string; kind?: string }>;
};

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('taxiPage.meta');
  const title = t('title');
  const description = t('description');
  const locale = await getLocale();
  return {
    title,
    description,
    alternates: await publicAlternatesFor('/taxiutbildning'),
    openGraph: {
      type: 'website',
      siteName,
      title: `${title} · ${siteName}`,
      description,
      url: absoluteUrl(localePath(locale, '/taxiutbildning')),
    },
  };
}

export default async function TaxiTrainingPage({ searchParams }: Props) {
  const params = await searchParams;
  const filters = taxiFiltersFromSearch(params);
  const rows = await orderCatalogue('taxi', listTaxiTraining(filters), (row) => ({
    id: row.id,
    currency: row.currency,
    amount: row.amount,
    country: row.country,
    checkedAt: null,
  }));
  return <TaxiCatalogue filters={filters} rows={rows} countries={taxiCountries()} />;
}
