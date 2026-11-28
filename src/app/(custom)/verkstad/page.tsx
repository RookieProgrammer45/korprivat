import type { Metadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';
import { WorkshopCatalogue } from '@/components/custom/workshop-catalogue';
import { workshopCountries, workshopsInCountry } from '@/lib/discovery/workshop-store';
import {
  pageOfWorkshops,
  workshopCities,
  workshopFiltersFromSearch,
  workshopsForCity,
} from '@/lib/discovery/workshops';
import { absoluteUrl, publicAlternatesFor } from '@/lib/seo/alternates';
import { localePath } from '@/lib/seo/locale-path';
import { siteName } from '@/lib/site';

export const dynamic = 'force-dynamic';

type Props = {
  searchParams: Promise<{ country?: string; city?: string; page?: string }>;
};

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('workshopPage.meta');
  const title = t('title');
  const description = t('description');
  const locale = await getLocale();
  return {
    title,
    description,
    alternates: await publicAlternatesFor('/verkstad'),
    openGraph: {
      type: 'website',
      siteName,
      title: `${title} · ${siteName}`,
      description,
      url: absoluteUrl(localePath(locale, '/verkstad')),
    },
  };
}

export default async function WorkshopPage({ searchParams }: Props) {
  const params = await searchParams;
  const countries = workshopCountries();
  const filters = workshopFiltersFromSearch(params, countries);
  const inCountry = filters.country ? workshopsInCountry(filters.country) : [];
  const cities = workshopCities(inCountry);
  const matched = workshopsForCity(inCountry, filters.city);
  const page = pageOfWorkshops(matched, filters.page);
  const unknown = inCountry.some((row) => row.city.length === 0);
  return (
    <WorkshopCatalogue
      filters={filters}
      countries={countries}
      cities={cities}
      unknown={unknown}
      rows={page.rows}
      total={page.total}
      pages={page.pages}
    />
  );
}
