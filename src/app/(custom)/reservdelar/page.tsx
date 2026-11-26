import type { Metadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';
import { PartsCatalogue } from '@/components/custom/parts-catalogue';
import { absoluteUrl, publicAlternatesFor } from '@/lib/seo/alternates';
import { localePath } from '@/lib/seo/locale-path';
import { siteName } from '@/lib/site';

export const dynamic = 'force-dynamic';

type Props = {
  searchParams: Promise<{
    q?: string;
    kind?: string;
    place?: string;
    lat?: string;
    lng?: string;
    buyer?: string;
    country?: string;
  }>;
};

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('partsPage.meta');
  const title = t('title');
  const description = t('description');
  const locale = await getLocale();
  return {
    title,
    description,
    alternates: await publicAlternatesFor('/reservdelar'),
    openGraph: {
      type: 'website',
      siteName,
      title: `${title} · ${siteName}`,
      description,
      url: absoluteUrl(localePath(locale, '/reservdelar')),
    },
  };
}

export default async function PartsPage({ searchParams }: Props) {
  const { q, kind, place, lat, lng, buyer, country } = await searchParams;
  return (
    <PartsCatalogue
      q={q}
      kind={kind}
      place={place}
      lat={lat}
      lng={lng}
      buyer={buyer}
      country={country}
    />
  );
}
