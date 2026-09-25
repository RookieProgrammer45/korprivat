// @polsia:user-owned — Västerås-specific instructor landing island.

'use client';

import { ArrowUpRight, CarFront, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { InstructorDirectory } from '@/components/custom/instructor-directory';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export function VasterasInstructorLanding() {
  const t = useTranslations('instructorsPage.vasterasCity');

  return (
    <main className="directory-shell min-h-[calc(100dvh-3.5rem)]">
      <section className="border-b border-border bg-muted/40">
        <div className="container-page section grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
          <div className="grid max-w-3xl gap-5">
            <Badge
              variant="outline"
              className="w-fit border-brand-500/40 bg-brand-100 text-brand-700 dark:bg-brand-900 dark:text-brand-300"
            >
              <span className="mr-2 size-1.5 rounded-full bg-brand-500" aria-hidden />
              {t('header.eyebrow')}
            </Badge>
            <h1 className="font-display text-h1 leading-tight tracking-tight text-foreground">
              {t('header.title')}
            </h1>
            <p className="max-w-2xl text-body-lg text-muted-foreground">{t('header.subtitle')}</p>
            <div className="flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link href="/instructors/vasteras#directory">
                  {t('cta.find')}
                  <ArrowUpRight className="ml-2 size-4" aria-hidden />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link href="/for-instructors">{t('cta.become')}</Link>
              </Button>
            </div>
          </div>

          <div className="grid gap-3 border-l border-brand-500/35 pl-5 sm:grid-cols-2 lg:grid-cols-1">
            <p className="text-eyebrow text-brand-700 dark:text-brand-300">
              {t('services.eyebrow')}
            </p>
            <p className="max-w-md text-small leading-relaxed text-muted-foreground">
              {t('services.subtitle')}
            </p>
          </div>
        </div>
      </section>

      <section className="container-page section grid gap-6">
        <header className="grid max-w-2xl gap-2">
          <p className="text-eyebrow">{t('services.eyebrow')}</p>
          <h2 className="font-display text-h2 leading-tight tracking-tight text-foreground">
            {t('services.title')}
          </h2>
          <p className="text-body text-muted-foreground">{t('services.subtitle')}</p>
        </header>
        <div className="grid gap-4 md:grid-cols-2">
          <ServiceTile
            icon={<CarFront className="size-5" aria-hidden />}
            title={t('services.trafiklarare.title')}
            body={t('services.trafiklarare.body')}
          />
          <Card className="surface-card lift border-border bg-card">
            <CardContent className="grid gap-4 p-6">
              <span className="flex size-10 items-center justify-center rounded-full border border-brand-500/40 bg-brand-100 text-brand-700 dark:bg-brand-900 dark:text-brand-300">
                <ShieldCheck className="size-5" aria-hidden />
              </span>
              <div className="grid gap-2">
                <h3 className="font-display text-h4 tracking-tight text-foreground">
                  {t('services.handledare.title')}
                </h3>
                <p className="text-body text-muted-foreground">{t('services.handledare.body')}</p>
                <Button asChild variant="outline" size="sm" className="w-fit">
                  <Link href="/handledare">{t('cta.find')}</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <section id="directory" className="border-t border-border bg-muted/35">
        <div className="container-page section grid gap-7">
          <div className="grid gap-2 lg:grid-cols-[1fr_auto] lg:items-end lg:gap-8">
            <div className="grid max-w-2xl gap-2">
              <p className="text-eyebrow">{t('cta.eyebrow')}</p>
              <h2 className="font-display text-h2 leading-tight tracking-tight text-foreground">
                {t('cta.title')}
              </h2>
              <p className="text-body text-muted-foreground">{t('cta.body')}</p>
            </div>
            <Button asChild variant="outline" size="sm" className="w-fit">
              <Link href="/for-instructors">{t('cta.become')}</Link>
            </Button>
          </div>
          <InstructorDirectory initialFilters={{ city: 'Västerås' }} />
        </div>
      </section>
    </main>
  );
}

function ServiceTile({ icon, title, body }: { icon: ReactNode; title: string; body: string }) {
  return (
    <Card className="surface-card lift border-border bg-card">
      <CardContent className="grid gap-4 p-6">
        <span className="flex size-10 items-center justify-center rounded-full border border-brand-500/40 bg-brand-100 text-brand-700 dark:bg-brand-900 dark:text-brand-300">
          {icon}
        </span>
        <div className="grid gap-2">
          <h3 className="font-display text-h4 tracking-tight text-foreground">{title}</h3>
          <p className="text-body text-muted-foreground">{body}</p>
        </div>
      </CardContent>
    </Card>
  );
}
