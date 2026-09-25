// @polsia:user-owned — Uppsala provider directory SEO shell.

import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { PublicDirectoryPage } from '@/components/custom/public-directory-page';
import { siteName, siteUrl } from '@/lib/site';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('instructorsPage.uppsalaCity.meta');
  return {
    title: t('title'),
    description: t('description'),
    alternates: { canonical: '/instructors/uppsala' },
    openGraph: {
      type: 'website',
      siteName,
      title: t('ogTitle'),
      description: t('ogDescription'),
      url: `${siteUrl}/instructors/uppsala`,
    },
    twitter: { card: 'summary_large_image', title: t('ogTitle'), description: t('ogDescription') },
  };
}

export default async function UppsalaInstructorsPage() {
  const t = await getTranslations('instructorsPage.uppsalaCity');
  const parent = await getTranslations('instructorsPage.header');
  const url = `${siteUrl}/instructors/uppsala`;
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
      { '@type': 'ItemList', name: t('header.title'), description: t('header.subtitle'), url },
    ],
  };

  return (
    <>
      <PublicDirectoryPage city="uppsala" cityName="Uppsala" />
      <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
    </>
  );
}
