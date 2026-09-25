// @polsia:user-owned — localized public Western and Northern Sweden SEO hub island.

'use client';

import { ArrowUpRight, ChevronRight, Compass, MountainSnow, RotateCcw } from 'lucide-react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { defaultLocale, isLocale } from '@/i18n/config';
import { apiFetch } from '@/lib/api-client';
import {
  type WesternNorthernSwedenHubResponse,
  WesternNorthernSwedenHub as WesternNorthernSwedenHubSchema,
} from '@/lib/contracts/western-northern-sweden';

export function WesternNorthernSwedenHub() {
  const locale = useLocale();
  const activeLocale = isLocale(locale) ? locale : defaultLocale;
  const tUi = useTranslations('westernNorthernSwedenPage.ui');
  const [data, setData] = useState<WesternNorthernSwedenHubResponse | null>(null);
  const [hasError, setHasError] = useState(false);
  const [retryNonce, setRetryNonce] = useState(0);

  useEffect(() => {
    let active = true;
    setData(null);
    setHasError(false);
    void retryNonce;

    apiFetch(`/api/western-northern-sweden?locale=${activeLocale}`, {
      schema: WesternNorthernSwedenHubSchema,
    })
      .then((response) => {
        if (!active) return;
        setData(response);
      })
      .catch(() => {
        if (!active) return;
        setHasError(true);
      });

    return () => {
      active = false;
    };
  }, [activeLocale, retryNonce]);

  if (hasError) {
    return (
      <main className="container-page section min-h-[calc(100dvh-4rem)]">
        <div
          className="mx-auto grid max-w-xl gap-5 rounded-[calc(var(--radius)+0.25rem)] border border-border bg-card p-8 text-center shadow-lg"
          role="alert"
        >
          <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-brand-100 text-brand-700 dark:bg-brand-900 dark:text-brand-300">
            <RotateCcw aria-hidden className="size-5" />
          </div>
          <p className="font-display text-h3 text-foreground">{tUi('error')}</p>
          <Button
            type="button"
            className="mx-auto"
            onClick={() => setRetryNonce((value) => value + 1)}
          >
            {tUi('retry')}
          </Button>
        </div>
      </main>
    );
  }

  if (!data) {
    return <HubLoading label={tUi('loading')} />;
  }

  return (
    <main className="western-northern-sweden-hub min-w-0 bg-background">
      <section className="relative overflow-hidden border-b border-border bg-muted/35">
        <div className="container-page grid min-w-0 gap-12 py-16 md:py-24 lg:grid-cols-[1.08fr_0.92fr] lg:items-end lg:gap-20">
          <div className="grid min-w-0 gap-7">
            <Badge
              className="w-fit border-brand-500/35 bg-brand-100 text-brand-700 dark:bg-brand-900 dark:text-brand-300"
              variant="outline"
            >
              <span className="mr-2 size-1.5 rounded-full bg-brand-500" aria-hidden />
              {data.hero.eyebrow}
            </Badge>
            <h1 className="max-w-4xl font-display text-display leading-[0.94] tracking-[-0.06em] text-foreground">
              {data.hero.title}
            </h1>
            <p className="max-w-2xl text-body-lg text-muted-foreground">{data.hero.body}</p>
            <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center">
              <Button asChild size="lg">
                <Link href="/instructors">
                  {data.hero.primaryCta} <ArrowUpRight aria-hidden />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link href="#regions">{data.hero.secondaryCta}</Link>
              </Button>
            </div>
          </div>

          <Card className="relative overflow-hidden border-brand-500/30 bg-primary text-primary-foreground shadow-lg">
            <CardContent className="grid gap-7 p-7 sm:p-9">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <MountainSnow aria-hidden className="size-7" />
                  <span className="font-display text-small uppercase tracking-[0.16em] opacity-80">
                    {data.hero.eyebrow}
                  </span>
                </div>
                <span className="font-display text-small uppercase tracking-[0.16em] opacity-75">
                  {String(data.regions.length).padStart(2, '0')}
                </span>
              </div>
              <Separator className="bg-primary-foreground/25" />
              <div className="grid gap-4">
                {data.regions.map((region, index) => (
                  <Link
                    className="group flex items-center justify-between gap-4 border-b border-primary-foreground/15 pb-3 text-body transition-transform duration-200 hover:translate-x-1 last:border-b-0 last:pb-0"
                    href={`#${region.slug}`}
                    key={region.slug}
                  >
                    <span className="flex items-center gap-3">
                      <span className="font-display text-small opacity-60">0{index + 1}</span>
                      <span>{region.name}</span>
                    </span>
                    <ChevronRight
                      aria-hidden
                      className="size-4 opacity-60 transition-transform group-hover:translate-x-1"
                    />
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="section border-b border-border">
        <div className="container-page grid min-w-0 gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20">
          <header className="grid content-start gap-3">
            <p className="text-eyebrow text-brand-700 dark:text-brand-300">
              {data.learnerGuide.eyebrow}
            </p>
            <h2 className="font-display text-h2 leading-tight tracking-tight text-foreground">
              {data.learnerGuide.title}
            </h2>
            <p className="max-w-md text-body text-muted-foreground">{data.learnerGuide.body}</p>
          </header>
          <ol className="grid min-w-0 gap-4">
            {data.learnerGuide.steps.map((step, index) => (
              <li
                className="grid grid-cols-[3.25rem_1fr] gap-4 border-b border-border pb-5 last:border-b-0 last:pb-0"
                key={step.title}
              >
                <span className="flex size-11 items-center justify-center rounded-full border border-brand-500/40 bg-brand-100 font-display text-small font-semibold text-brand-700 dark:bg-brand-900 dark:text-brand-300">
                  0{index + 1}
                </span>
                <div className="grid gap-1">
                  <h3 className="font-display text-h4 tracking-tight text-foreground">
                    {step.title}
                  </h3>
                  <p className="text-body text-muted-foreground">{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section id="regions" className="scroll-mt-20 border-b border-border bg-muted/30">
        <div className="container-page section grid min-w-0 gap-9">
          <header className="grid max-w-2xl gap-3">
            <p className="text-eyebrow text-brand-700 dark:text-brand-300">
              {data.regionNav.eyebrow}
            </p>
            <h2 className="font-display text-h2 leading-tight tracking-tight text-foreground">
              {data.regionNav.title}
            </h2>
            <p className="text-body-lg text-muted-foreground">{data.regionNav.body}</p>
          </header>
          <nav
            aria-label={data.ui.regionNavLabel}
            className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
          >
            {data.regions.map((region) => (
              <Link
                className="group flex min-h-28 flex-col justify-between rounded-[calc(var(--radius)+0.1rem)] border border-border bg-card p-5 shadow-sm transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-1 hover:border-brand-400 hover:shadow-md"
                href={`#${region.slug}`}
                key={region.slug}
              >
                <span className="font-display text-h4 tracking-tight text-foreground">
                  {region.name}
                </span>
                <span className="flex items-center gap-1 text-small font-semibold text-brand-700 dark:text-brand-300">
                  {data.regionNav.jumpLabel}{' '}
                  <ArrowUpRight
                    aria-hidden
                    className="size-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                  />
                </span>
              </Link>
            ))}
          </nav>
        </div>
      </section>

      {data.regions.map((region, index) => (
        <section
          className={`scroll-mt-20 border-b border-border ${index % 2 === 0 ? 'bg-background' : 'bg-muted/30'}`}
          id={region.slug}
          key={region.slug}
        >
          <div className="container-page section grid min-w-0 gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:items-start lg:gap-20">
            <header className="grid content-start gap-4">
              <span className="font-display text-small font-semibold tracking-[0.14em] text-brand-700 dark:text-brand-300">
                0{index + 1} / {String(data.regions.length).padStart(2, '0')}
              </span>
              <h2 className="font-display text-h2 leading-tight tracking-tight text-foreground">
                {region.name}
              </h2>
              <p className="text-body-lg text-muted-foreground">{region.description}</p>
              <Link
                className="flex w-fit items-center gap-2 text-small font-semibold text-brand-700 underline-offset-4 transition-colors hover:text-brand-900 hover:underline dark:text-brand-300 dark:hover:text-brand-100"
                href="#regions"
              >
                {data.ui.backToRegions} <ArrowUpRight aria-hidden className="size-4" />
              </Link>
            </header>
            <Card className="surface-card border-border bg-card shadow-md">
              <CardContent className="grid gap-5 p-6 sm:p-8">
                <div className="flex items-center gap-3 text-muted-foreground">
                  <Compass aria-hidden className="size-5 text-brand-700 dark:text-brand-300" />
                  <p className="text-small font-semibold uppercase tracking-[0.12em]">
                    {data.ui.cityListingLabel}
                  </p>
                </div>
                <Separator />
                <div className="grid gap-3 sm:grid-cols-2">
                  {region.cities.map((city) => (
                    <Button
                      asChild
                      key={city.href}
                      variant="outline"
                      className="h-auto min-h-12 justify-between px-4 py-3 text-left"
                    >
                      <Link href={city.href} aria-label={`${data.ui.cityLinkPrefix} ${city.label}`}>
                        <span>{city.label}</span>
                        <ChevronRight
                          aria-hidden
                          className="size-4 text-brand-700 dark:text-brand-300"
                        />
                      </Link>
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </section>
      ))}

      <section className="border-b border-border bg-primary text-primary-foreground">
        <div className="container-page section grid min-w-0 gap-8 lg:grid-cols-[1fr_auto] lg:items-end">
          <div className="grid max-w-2xl gap-3">
            <p className="text-eyebrow opacity-75">{data.cta.eyebrow}</p>
            <h2 className="font-display text-h2 leading-tight tracking-tight">{data.cta.title}</h2>
            <p className="text-body-lg opacity-80">{data.cta.body}</p>
          </div>
          <Button asChild variant="secondary" size="lg">
            <Link href="/instructors" aria-label={data.cta.ariaLabel}>
              {data.cta.button} <ArrowUpRight aria-hidden />
            </Link>
          </Button>
        </div>
      </section>
    </main>
  );
}

function HubLoading({ label }: { label: string }) {
  return (
    <main className="container-page section min-h-[calc(100dvh-4rem)]" aria-busy="true">
      <div className="grid gap-10 lg:grid-cols-[1.08fr_0.92fr]">
        <div className="grid content-start gap-6">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-36 w-full max-w-2xl" />
          <Skeleton className="h-16 w-full max-w-xl" />
          <Skeleton className="h-12 w-56" />
        </div>
        <Skeleton className="h-80 w-full rounded-[calc(var(--radius)+0.25rem)]" />
      </div>
      <output className="sr-only">{label}</output>
    </main>
  );
}
