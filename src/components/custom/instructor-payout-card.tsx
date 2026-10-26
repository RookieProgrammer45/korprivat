//
// Directory listing note for a school dashboard. Catalog listing is free.
// This card does not fetch or display a commission rate.

'use client';

import { useTranslations } from 'next-intl';
import { Card, CardContent } from '@/components/ui/card';

export function InstructorPayoutCard() {
  const t = useTranslations('instructorPayoutCard');

  return (
    <Card className="surface-card border-brand-500/40 bg-brand-100 shadow-sm dark:bg-brand-900">
      <CardContent className="grid gap-5 p-6">
        <header className="grid gap-1">
          <p className="text-eyebrow text-brand-700 dark:text-brand-300">{t('eyebrow')}</p>
          <h2 className="font-display text-h2 leading-tight tracking-tight text-foreground">
            {t('title')}
          </h2>
        </header>

        <p className="text-body-lg text-foreground">{t('body')}</p>
        <p className="text-body text-muted-foreground">{t('payoutLine')}</p>
      </CardContent>
    </Card>
  );
}
