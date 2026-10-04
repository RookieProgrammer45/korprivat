import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { CitySeoSection, cityFaqJsonLd } from '@/components/custom/city-seo-section';
import { PublicDirectoryPage } from '@/components/custom/public-directory-page';
import { absoluteUrl, publicAlternates } from '@/lib/seo/alternates';
import { type CityHubKey, cityHubPath } from '@/lib/seo/city-hubs';
import { siteName, siteUrl } from '@/lib/site';

type Props = {
  city: CityHubKey;
  cityName: string;
};

export async function cityInstructorsMetadata(city: CityHubKey): Promise<Metadata> {
  const path = cityHubPath(city);
  const t = await getTranslations(`instructorsPage.${city}City.meta`);
  const alternates = publicAlternates(path);
  return {
    title: t('title'),
    description: t('description'),
    alternates,
    openGraph: {
      type: 'website',
      siteName,
      title: t('ogTitle'),
      description: t('ogDescription'),
      url: absoluteUrl(path),
    },
    twitter: {
      card: 'summary_large_image',
      title: t('ogTitle'),
      description: t('ogDescription'),
    },
  };
}

export async function CityInstructorsLanding({ city, cityName }: Props) {
  const path = cityHubPath(city);
  const t = await getTranslations(`instructorsPage.${city}City`);
  const parent = await getTranslations('instructorsPage.header');
  const tSeo = await getTranslations(`instructorsPage.${city}City.seo`);
  const url = absoluteUrl(path);

  const faq = [
    { q: tSeo('faq1q'), a: tSeo('faq1a') },
    { q: tSeo('faq2q'), a: tSeo('faq2a') },
    { q: tSeo('faq3q'), a: tSeo('faq3a') },
  ];

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage',
        name: t('header.title'),
        description: t('meta.description'),
        url,
        inLanguage: 'sv-SE',
        isPartOf: { '@type': 'WebSite', name: siteName, url: `${siteUrl}/` },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: siteName, item: `${siteUrl}/` },
          {
            '@type': 'ListItem',
            position: 2,
            name: parent('title'),
            item: `${siteUrl}/instructors`,
          },
          { '@type': 'ListItem', position: 3, name: t('header.title'), item: url },
        ],
      },
      cityFaqJsonLd(faq),
      { '@type': 'ItemList', name: t('header.title'), description: t('header.subtitle'), url },
    ],
  };

  return (
    <>
      <PublicDirectoryPage city={city} cityName={cityName} />
      <CitySeoSection city={city} />
      <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
    </>
  );
}
