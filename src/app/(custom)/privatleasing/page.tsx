import type { Metadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';
import { LeasingCatalogue } from '@/components/custom/leasing-catalogue';
import { orderCatalogue } from '@/lib/discovery/catalogue-rank-store';
import { leaseCountries, leaseFiltersFromSearch, listLeases } from '@/lib/discovery/leasing';
import { absoluteUrl, publicAlternatesFor } from '@/lib/seo/alternates';
import { localePath } from '@/lib/seo/locale-path';
import { siteName } from '@/lib/site';

export const dynamic = 'force-dynamic';

type Props = {
  searchParams: Promise<{ country?: string }>;
};

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('leasingPage.meta');
  const title = t('title');
  const description = t('description');
  const locale = await getLocale();
  return {
    title,
    description,
    alternates: await publicAlternatesFor('/privatleasing'),
    openGraph: {
      type: 'website',
      siteName,
      title: `${title} · ${siteName}`,
      description,
      url: absoluteUrl(localePath(locale, '/privatleasing')),
    },
  };
}

export default async function LeasingPage({ searchParams }: Props) {
  const params = await searchParams;
  const filters = leaseFiltersFromSearch(params);
  const rows = await orderCatalogue('lease', listLeases(filters), (row) => ({
    id: row.id,
    currency: row.currency,
    amount: row.amount,
    country: row.country,
    checkedAt: null,
  }));
  return <LeasingCatalogue filters={filters} rows={rows} countries={leaseCountries()} />;
}
