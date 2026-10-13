import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { ProviderEntry } from '@/components/custom/provider-entry';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('forInstructorsPage.meta');
  return {
    title: t('title'),
    description: t('description'),
    alternates: { canonical: '/for-instructors' },
  };
}

export default function ForInstructorsPage() {
  return <ProviderEntry />;
}
