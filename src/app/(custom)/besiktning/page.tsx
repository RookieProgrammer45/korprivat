import type { Metadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';
import { InspectionCatalogue } from '@/components/custom/inspection-catalogue';
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
  return (
    <InspectionCatalogue
      filters={filters}
      rows={listInspections(filters)}
      countries={inspectionCountries()}
    />
  );
}
