// @polsia:user-owned — metadata shell for the marketplace fee explainer.

import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { PricingPage } from '@/components/custom/pricing-page';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('pricingPage.meta');
  return {
    title: t('title'),
    description: t('description'),
    alternates: { canonical: '/pricing' },
  };
}

export default function PricingRoute() {
  return <PricingPage />;
}
