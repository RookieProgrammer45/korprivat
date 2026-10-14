import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { AboutContent } from '@/components/custom/about-content';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('aboutPage.meta');
  return {
    title: { absolute: `${t('title')} · DriveLinkUp` },
    description: t('description'),
    alternates: { canonical: '/om-oss' },
  };
}

export default function AboutPage() {
  return <AboutContent />;
}
