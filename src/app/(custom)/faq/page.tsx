// @polsia:user-owned — public FAQ shell.

import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { PublicFaq } from '@/components/custom/public-faq';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('faqPage.header');
  return {
    title: t('title'),
    description: t('subtitle'),
    alternates: { canonical: '/faq' },
  };
}

export default function FaqPage() {
  return <PublicFaq />;
}
