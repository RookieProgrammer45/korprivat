import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { PublicDirectoryPage } from '@/components/custom/public-directory-page';
import { PublicDirectorySeo } from '@/components/custom/public-directory-seo';
import { requireCatalogSession } from '@/lib/catalog-guard';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('instructorsPage.header');
  return {
    title: t('title'),
    description: t('subtitle'),
    alternates: { canonical: '/instructors' },
  };
}

export default async function InstructorsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(sp)) {
    const first = Array.isArray(value) ? value[0] : value;
    if (typeof first === 'string' && first.length > 0) qs.set(key, first);
  }
  await requireCatalogSession(qs.size > 0 ? `/instructors?${qs}` : '/instructors');
  return (
    <PublicDirectoryPage>
      <PublicDirectorySeo />
    </PublicDirectoryPage>
  );
}
