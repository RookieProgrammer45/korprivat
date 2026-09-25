// @polsia:user-owned — provider entry shell.

import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { ProviderEntry } from '@/components/custom/provider-entry';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('providerEntry');
  return {
    title: t('meta.title'),
    description: t('meta.description'),
    alternates: { canonical: '/for-instructors' },
  };
}

export default function ForInstructorsPage() {
  return <ProviderEntry />;
}
