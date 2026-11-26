import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import {
  isCategoryOfferingsOn,
  isOfferingCategory,
} from '@/lib/acquisition/category-offering-policy';
import { listCategoryOfferings } from '@/lib/acquisition/category-offering-store';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ category: string }>;
}): Promise<Metadata> {
  const t = await getTranslations('categoryLanding');
  const { category } = await params;
  return {
    title: t('title', { category: isOfferingCategory(category) ? category : '' }),
    robots: { index: false, follow: false },
  };
}

export default async function CategoryLandingPage({
  params,
}: {
  params: Promise<{ category: string }>;
}) {
  if (!isCategoryOfferingsOn()) notFound();
  const { category } = await params;
  if (!isOfferingCategory(category)) notFound();
  const t = await getTranslations('categoryLanding');
  const offerings = await listCategoryOfferings(category);
  return (
    <main className="mx-auto grid max-w-3xl gap-4 px-6 py-12">
      <h1 className="font-display text-3xl font-semibold">{t('title', { category })}</h1>
      <p className="text-sm text-muted-foreground">{t('body')}</p>
      {offerings.length === 0 ? (
        <p className="text-sm">{t('empty')}</p>
      ) : (
        <ul className="grid gap-2">
          {offerings.map((offering) => (
            <li key={offering.offeringId} className="text-sm">
              {offering.category}
              {offering.policyVersion != null ? ` · v${offering.policyVersion}` : ''}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
