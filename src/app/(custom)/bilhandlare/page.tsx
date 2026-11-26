import type { Metadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';
import { DealershipCatalogue } from '@/components/custom/dealership-catalogue';
import { absoluteUrl, publicAlternatesFor } from '@/lib/seo/alternates';
import { localePath } from '@/lib/seo/locale-path';
import { siteName } from '@/lib/site';

export const dynamic = 'force-dynamic';

type Props = {
  searchParams: Promise<{
    city?: string;
    kind?: string;
    country?: string;
    q?: string;
    condition?: string;
  }>;
};

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('dealershipsPage.meta');
  const title = t('title');
  const description = t('description');
  const locale = await getLocale();
  return {
    title,
    description,
    alternates: await publicAlternatesFor('/bilhandlare'),
    openGraph: {
      type: 'website',
      siteName,
      title: `${title} · ${siteName}`,
      description,
      url: absoluteUrl(localePath(locale, '/bilhandlare')),
    },
  };
}

export default async function DealershipsPage({ searchParams }: Props) {
  const { city, kind, country, q, condition } = await searchParams;
  return (
    <DealershipCatalogue city={city} kind={kind} country={country} q={q} condition={condition} />
  );
}
