
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { WesternNorthernSwedenHub } from '@/components/custom/western-northern-sweden-hub';
import { siteName, siteUrl } from '@/lib/site';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('westernNorthernSwedenPage.meta');
  const url = `${siteUrl}/western-northern-sweden`;

  return {
    title: t('title'),
    description: t('description'),
    alternates: { canonical: '/western-northern-sweden' },
    openGraph: {
      type: 'website',
      siteName,
      title: t('ogTitle'),
      description: t('ogDescription'),
      url,
    },
    twitter: {
      card: 'summary_large_image',
      title: t('ogTitle'),
      description: t('ogDescription'),
    },
  };
}

export default function WesternNorthernSwedenPage() {
  return <WesternNorthernSwedenHub />;
}
