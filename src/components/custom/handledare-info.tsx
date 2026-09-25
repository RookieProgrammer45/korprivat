// @polsia:user-owned — explicit Swedish handledare distinction.

'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function HandledareInfo() {
  const t = useTranslations('handledareInfo');
  return (
    <main className="container-page section grid gap-10">
      <header className="mx-auto grid max-w-3xl gap-4">
        <p className="text-eyebrow">{t('eyebrow')}</p>
        <h1 className="font-display text-display leading-none tracking-tight">{t('title')}</h1>
        <p className="text-body-lg text-muted-foreground">{t('lead')}</p>
      </header>
      <div className="mx-auto grid max-w-4xl gap-5 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t('private.title')}</CardTitle>
          </CardHeader>
          <CardContent className="text-body text-muted-foreground">{t('private.body')}</CardContent>
        </Card>
        <Card className="border-brand-500/35 bg-brand-100 dark:bg-brand-900">
          <CardHeader>
            <CardTitle>{t('schools.title')}</CardTitle>
          </CardHeader>
          <CardContent className="text-body text-muted-foreground">{t('schools.body')}</CardContent>
        </Card>
      </div>
      <div className="mx-auto flex max-w-4xl flex-col gap-3 sm:flex-row">
        <Button asChild>
          <Link href="/instructors">{t('cta.schools')}</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/faq">{t('cta.faq')}</Link>
        </Button>
      </div>
    </main>
  );
}
