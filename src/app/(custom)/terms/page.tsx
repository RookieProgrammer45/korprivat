import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { TermsContent } from '@/components/custom/terms-content';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('termsPage.meta');
  return {
    title: { absolute: `${t('title')} · DriveLinkUp` },
    description: t('description'),
    alternates: { canonical: '/terms' },
  };
}

export default function TermsPage() {
  return <TermsContent />;
}
