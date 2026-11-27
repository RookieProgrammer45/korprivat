import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { PublicHome } from '@/components/custom/public-home';
import { defaultLocale, isLocale } from '@/i18n/config';
import { siteDescription, siteName, siteTitleSv } from '@/lib/brand';
import { resolveLocale } from '@/lib/i18n';
import { absoluteUrl, publicAlternates } from '@/lib/seo/alternates';
import { localeHreflang, localePath } from '@/lib/seo/locale-path';
import { NORDIC_COUNTRIES } from '@/lib/seo/nordic-locations';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const locale = await resolveLocale();
  const t = await getTranslations('publicHome.hero');
  // Absolute title: the layout template would otherwise append "· DriveLinkUp"
  // and push the keyword past the ~60 characters Google shows.
  const title = locale === 'sv' ? siteTitleSv : t('metaTitle');
  const description = locale === 'sv' ? siteDescription : t('metaDescription');
  const path = localePath(locale, '/');
  return {
    title: { absolute: title },
    description,
    alternates: publicAlternates('/', locale),
    openGraph: {
      type: 'website',
      locale: (isLocale(locale) ? localeHreflang[locale] : localeHreflang[defaultLocale]).replace(
        '-',
        '_',
      ),
      siteName,
      title,
      description,
      url: absoluteUrl(path),
    },
  };
}

export default async function DriveLinkUpLanding({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const { category } = await searchParams;
  const locale = await resolveLocale();
  const t = await getTranslations('publicHome.hero');
  const description = locale === 'sv' ? siteDescription : t('metaDescription');
  const url = absoluteUrl(localePath(locale, '/'));
  const inLanguage = isLocale(locale) ? localeHreflang[locale] : localeHreflang[defaultLocale];
  const catalogues = [
    { name: t('popular.links.inspection'), path: '/besiktning' },
    { name: t('popular.links.tires'), path: '/dack' },
    { name: t('popular.links.taxi'), path: '/taxiutbildning' },
    { name: t('popular.links.leasing'), path: '/privatleasing' },
    { name: t('popular.links.parking'), path: '/parkering' },
    { name: t('popular.links.ownerParts'), path: '/reservdelar?buyer=owner' },
    { name: t('popular.links.workshopParts'), path: '/reservdelar?buyer=workshop' },
    { name: t('popular.links.heavy'), path: '/tung-trafik' },
    { name: t('popular.links.dealers'), path: '/bilhandlare' },
    { name: t('titleSchool'), path: '/locations' },
  ];
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        name: siteName,
        url: absoluteUrl('/'),
        email: 'frank@drivelinkup.com',
        areaServed: NORDIC_COUNTRIES.map((code) => code.toUpperCase()),
        description,
      },
      {
        '@type': 'WebSite',
        name: siteName,
        url,
        description,
        inLanguage,
        publisher: { '@type': 'Organization', name: siteName },
        potentialAction: {
          '@type': 'SearchAction',
          target: absoluteUrl('/reservdelar?q={search_term_string}'),
          'query-input': 'required name=search_term_string',
        },
      },
      {
        '@type': 'ItemList',
        name: t('search.modeLabel'),
        itemListElement: catalogues.map((item, index) => ({
          '@type': 'ListItem',
          position: index + 1,
          name: item.name,
          url: absoluteUrl(item.path),
        })),
      },
    ],
  };

  return (
    <>
      <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
      <PublicHome category={category} />
    </>
  );
}
