import type { Metadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';
import { TireCatalogue } from '@/components/custom/tire-catalogue';
import { orderCatalogue } from '@/lib/discovery/catalogue-rank-store';
import { listTires, tireCountries, tireFiltersFromSearch } from '@/lib/discovery/tires';
import { absoluteUrl, publicAlternatesFor } from '@/lib/seo/alternates';
import { localePath } from '@/lib/seo/locale-path';
import { siteName } from '@/lib/site';

export const dynamic = 'force-dynamic';

type Props = {
  searchParams: Promise<{ country?: string; vehicle?: string; service?: string }>;
};

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('tirePage.meta');
  const title = t('title');
  const description = t('description');
  const locale = await getLocale();
  return {
    title,
    description,
    alternates: await publicAlternatesFor('/dack'),
    openGraph: {
      type: 'website',
      siteName,
      title: `${title} · ${siteName}`,
      description,
      url: absoluteUrl(localePath(locale, '/dack')),
    },
  };
}

export default async function TirePage({ searchParams }: Props) {
  const params = await searchParams;
  const filters = tireFiltersFromSearch(params);
  const rows = await orderCatalogue('tire', listTires(filters), (row) => ({
    id: row.id,
    currency: row.currency,
    amount: row.amount,
    country: row.country,
    checkedAt: null,
  }));
  return <TireCatalogue filters={filters} rows={rows} countries={tireCountries()} />;
}
