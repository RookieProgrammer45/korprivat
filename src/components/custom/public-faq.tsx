// @polsia:user-owned — learner FAQ island.

'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Faq } from '@/components/custom/faq';
import { Button } from '@/components/ui/button';

const FAQ_KEYS = [
  'scope',
  'choose',
  'booking',
  'price',
  'safety',
  'cancellation',
  'prerequisites',
] as const;

export function PublicFaq() {
  const t = useTranslations('faqPage');
  const items = FAQ_KEYS.map((key) => ({
    q: t(`items.${key}.q`),
    a: t(`items.${key}.a`),
  }));

  return (
    <main className="container-page section min-h-[calc(100dvh-3.5rem)]">
      <header className="mx-auto flex max-w-3xl flex-col gap-3">
        <p className="text-eyebrow">{t('header.eyebrow')}</p>
        <h1 className="font-display text-h1 leading-tight tracking-tight text-foreground">
          {t('header.title')}
        </h1>
        <p className="max-w-2xl text-body-lg text-muted-foreground">{t('header.subtitle')}</p>
      </header>
      <div className="mx-auto mt-10 max-w-3xl rounded-xl border border-border bg-card p-2 sm:p-4">
        <Faq items={items} />
      </div>
      <div className="mx-auto mt-10 flex max-w-3xl flex-col gap-3 sm:flex-row">
        <Button asChild size="lg">
          <Link href="/instructors">{t('cta.findProviders')}</Link>
        </Button>
        <Button asChild variant="outline" size="lg">
          <Link href="/contact">{t('cta.contact')}</Link>
        </Button>
      </div>
    </main>
  );
}
