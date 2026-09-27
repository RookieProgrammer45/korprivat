
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { SouthernSwedenHub } from '@/components/custom/southern-sweden-hub';
import { siteName, siteUrl } from '@/lib/site';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('southernSwedenPage.meta');
  const url = `${siteUrl}/southern-sweden`;

  return {
    title: t('title'),
    description: t('description'),
    alternates: { canonical: '/southern-sweden' },
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

export default function SouthernSwedenPage() {
  return <SouthernSwedenHub />;
}
