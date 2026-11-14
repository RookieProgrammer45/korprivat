import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { PublicHome } from '@/components/custom/public-home';
import { defaultLocale, isLocale } from '@/i18n/config';
import { siteDescription, siteName } from '@/lib/brand';
import { resolveLocale } from '@/lib/i18n';
import { absoluteUrl, publicAlternates } from '@/lib/seo/alternates';
import { localeHreflang, localePath } from '@/lib/seo/locale-path';

export async function generateMetadata(): Promise<Metadata> {
  const locale = await resolveLocale();
  const t = await getTranslations('publicHome.hero');
  const title =
    locale === 'sv'
      ? `${siteName} – Jämför trafikskolor runtom i landet`
      : `${siteName} – ${t('title')}`;
  const description = locale === 'sv' ? siteDescription : t('body');
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
  const description = locale === 'sv' ? siteDescription : t('body');
  const url = absoluteUrl(localePath(locale, '/'));
  const inLanguage = isLocale(locale) ? localeHreflang[locale] : localeHreflang[defaultLocale];
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        name: siteName,
        url: absoluteUrl('/'),
        email: 'frank@drivelinkup.com',
        areaServed: 'SE',
        description,
      },
      {
        '@type': 'WebSite',
        name: siteName,
        url,
        description,
        inLanguage,
        publisher: { '@type': 'Organization', name: siteName },
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
