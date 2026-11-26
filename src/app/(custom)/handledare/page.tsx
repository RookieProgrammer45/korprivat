import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { HandledareInfo } from '@/components/custom/handledare-info';
import { publicAlternatesFor } from '@/lib/seo/alternates';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('handledareInfo.meta');
  return {
    title: t('title'),
    description: t('description'),
    alternates: await publicAlternatesFor('/handledare'),
  };
}

export default function HandledarePage() {
  return <HandledareInfo />;
}
