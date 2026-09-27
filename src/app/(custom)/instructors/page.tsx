
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { PublicDirectoryPage } from '@/components/custom/public-directory-page';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('instructorsPage.header');
  return {
    title: t('title'),
    description: t('subtitle'),
    alternates: { canonical: '/instructors' },
  };
}

export default function InstructorsPage() {
  return <PublicDirectoryPage />;
}
