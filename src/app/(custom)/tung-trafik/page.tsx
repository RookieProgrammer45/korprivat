import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { HeavyVehiclesPage } from '@/components/custom/heavy-vehicles-page';
import { requireCatalogSession } from '@/lib/catalog-guard';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('heavyVehiclesPage');
  return {
    title: t('title'),
    description: t('subtitle'),
    alternates: { canonical: '/tung-trafik' },
  };
}

export default async function TungTrafikPage() {
  await requireCatalogSession('/tung-trafik');
  return <HeavyVehiclesPage />;
}
