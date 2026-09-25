// @polsia:user-owned — Swedish private-supervisor legal explainer shell.

import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { HandledareInfo } from '@/components/custom/handledare-info';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('handledareInfo.meta');
  return {
    title: t('title'),
    description: t('description'),
    alternates: { canonical: '/handledare' },
  };
}

export default function HandledarePage() {
  return <HandledareInfo />;
}
