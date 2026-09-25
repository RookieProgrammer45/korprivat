// @polsia:user-owned — learner/school marketplace fee explainer island.

'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function PricingPage() {
  const t = useTranslations('pricingPage');
  return (
    <main className="container-page section grid gap-12">
      <header className="mx-auto grid max-w-3xl gap-4 text-center">
        <Badge className="mx-auto w-fit" variant="outline">
          {t('hero.eyebrow')}
        </Badge>
        <h1 className="font-display text-display leading-none tracking-tight">{t('hero.title')}</h1>
        <p className="text-body-lg text-muted-foreground">{t('hero.body')}</p>
      </header>
      <div className="mx-auto grid w-full max-w-5xl gap-5 md:grid-cols-2">
        <Card className="border-brand-500/35 bg-brand-100 shadow-md dark:bg-brand-900">
          <CardHeader>
            <CardTitle>{t('learner.title')}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 text-body text-muted-foreground">
            <p>{t('learner.body')}</p>
            <p className="font-display text-h3 text-foreground">{t('learner.price')}</p>
            <p>{t('learner.detail')}</p>
          </CardContent>
        </Card>
        <Card className="shadow-md">
          <CardHeader>
            <CardTitle>{t('school.title')}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 text-body text-muted-foreground">
            <p>{t('school.body')}</p>
            <p className="font-display text-h3 text-foreground">{t('school.price')}</p>
            <p>{t('school.detail')}</p>
          </CardContent>
        </Card>
      </div>
      <section className="mx-auto grid w-full max-w-3xl gap-3 rounded-xl border border-border bg-muted/40 p-6 text-body">
        <h2 className="font-display text-h3">{t('notes.title')}</h2>
        <p className="text-muted-foreground">{t('notes.body')}</p>
        <div className="flex flex-col gap-3 pt-2 sm:flex-row">
          <Button asChild>
            <Link href="/instructors">{t('cta.learner')}</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/for-instructors">{t('cta.school')}</Link>
          </Button>
        </div>
      </section>
    </main>
  );
}
