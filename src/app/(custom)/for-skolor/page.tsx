// @polsia:user-owned — /for-skolor school waitlist entry (Organizations not started).

import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { SchoolInterestForm } from '@/components/custom/school-interest-form';
import { Badge } from '@/components/ui/badge';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('forSkolor');
  return {
    title: t('meta.title'),
    description: t('meta.description'),
    alternates: { canonical: '/for-skolor' },
  };
}

export default async function ForSkolorPage() {
  const t = await getTranslations('forSkolor');

  return (
    <main className="provider-entry-shell container-page section min-h-[calc(100dvh-3.5rem)]">
      <div className="mx-auto grid w-full max-w-xl gap-8">
        <header className="provider-entry-copy grid gap-4">
          <Badge
            variant="outline"
            className="w-fit border-brand-500/40 bg-brand-100 text-brand-700 dark:bg-brand-900 dark:text-brand-300"
          >
            {t('eyebrow')}
          </Badge>
          <h1 className="font-display text-h1 leading-tight tracking-tight text-foreground">
            {t('title')}
          </h1>
          <p className="text-body-lg text-muted-foreground">{t('body')}</p>
        </header>
        <SchoolInterestForm />
      </div>
    </main>
  );
}
