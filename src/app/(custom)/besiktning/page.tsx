import type { Metadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';
import { InspectionCatalogue } from '@/components/custom/inspection-catalogue';
import { orderCatalogue } from '@/lib/discovery/catalogue-rank-store';
import {
  inspectionCountries,
  inspectionFiltersFromSearch,
  listInspections,
} from '@/lib/discovery/inspections';
import { absoluteUrl, publicAlternatesFor } from '@/lib/seo/alternates';
import { localePath } from '@/lib/seo/locale-path';
import { siteName } from '@/lib/site';

export const dynamic = 'force-dynamic';

type Props = {
  searchParams: Promise<{ country?: string; vehicle?: string; inspection?: string }>;
};

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('inspectionPage.meta');
  const title = t('title');
  const description = t('description');
  const locale = await getLocale();
  return {
    title,
    description,
    alternates: await publicAlternatesFor('/besiktning'),
    openGraph: {
      type: 'website',
      siteName,
      title: `${title} · ${siteName}`,
      description,
      url: absoluteUrl(localePath(locale, '/besiktning')),
    },
  };
}

export default async function InspectionPage({ searchParams }: Props) {
  const params = await searchParams;
  const filters = inspectionFiltersFromSearch(params);
  const rows = await orderCatalogue('inspection', listInspections(filters), (row) => ({
    id: row.id,
    currency: row.currency,
    amount: row.amount,
    country: row.country,
    checkedAt: null,
  }));
  return <InspectionCatalogue filters={filters} rows={rows} countries={inspectionCountries()} />;
}
