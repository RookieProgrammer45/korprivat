// @polsia:user-owned — learner-first public home island.
//
// The page deliberately answers only the questions that move a learner toward
// a booking: what is available, what it costs, how the next step works, and
// where to find safety, cancellation, and support details.

'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { InstructorPreview } from '@/components/custom/instructor-preview';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

const QUICK_CATEGORIES = ['B', 'A', 'BE'] as const;
const QUICK_CITIES = [
  { id: 'stockholm', href: '/instructors/stockholm' },
  { id: 'goteborg', href: '/instructors/goteborg' },
  { id: 'malmo', href: '/instructors/malmo' },
  { id: 'vasteras', href: '/instructors/vasteras' },
] as const;

export function PublicHome() {
  const t = useTranslations('publicHome');

  return (
    <main className="marketplace-home relative isolate w-full min-w-0">
      <section className="marketplace-hero border-b border-border">
        <div className="marketplace-hero-grid container-page grid min-w-0 gap-10 py-16 md:py-28 lg:grid-cols-[1.12fr_0.88fr] lg:gap-20">
          <div className="marketplace-hero-copy marketplace-reveal flex min-w-0 flex-col gap-7">
            <Badge
              variant="outline"
              className="w-fit border-brand-500/40 bg-brand-100 text-brand-700 dark:bg-brand-900 dark:text-brand-300"
            >
              <span className="mr-2 inline-block size-1.5 rounded-full bg-brand-500" aria-hidden />
              {t('hero.eyebrow')}
            </Badge>
            <h1 className="marketplace-hero-title max-w-4xl font-display text-3xl leading-[1.05] tracking-tight text-balance text-foreground sm:text-4xl md:text-5xl lg:text-5xl xl:text-6xl">
              {t('hero.title')}
            </h1>
            <p className="max-w-2xl min-w-0 text-body-lg text-muted-foreground">{t('hero.body')}</p>
            <div className="marketplace-hero-actions flex min-w-0 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center lg:flex-nowrap">
              <Button asChild size="lg" className="marketplace-primary-cta">
                <Link href="/instructors">
                  {t('hero.primaryCta')} <span aria-hidden>→</span>
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="marketplace-secondary-cta">
                <Link href="/signup?role=instructor">{t('hero.instructorCta')}</Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="marketplace-secondary-cta">
                <Link href="/for-skolor">{t('hero.schoolCta')}</Link>
              </Button>
            </div>
            <div className="grid min-w-0 gap-2 border-t border-border pt-4 text-small text-muted-foreground sm:grid-cols-3 sm:gap-4">
              <p>{t('hero.assurance.price')}</p>
              <p>{t('hero.assurance.safety')}</p>
              <p>{t('hero.assurance.choice')}</p>
            </div>
          </div>

          <div className="marketplace-reveal relative min-w-0 lg:min-h-[640px]">
            <div className="absolute inset-0 hidden overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-100 lg:block dark:border-white/10 dark:bg-neutral-900">
              <div
                className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(0,200,150,0.10),transparent_70%)] opacity-40 dark:opacity-100"
                aria-hidden
              />
              <Image
                src="/images/hero-driving.png"
                alt={t('hero.imageAlt')}
                fill
                priority
                sizes="(max-width: 1024px) 100vw, 50vw"
                className="object-contain p-10 opacity-95 dark:opacity-85 dark:contrast-[0.92] dark:brightness-[0.95]"
                style={{ objectPosition: 'center 45%' }}
              />
            </div>

            <Card className="marketplace-hero-card z-10 min-w-0 border-neutral-200 bg-white/95 shadow-md backdrop-blur-sm lg:absolute lg:bottom-6 lg:left-6 lg:max-w-[400px] dark:border-white/10 dark:bg-black/85">
              <CardContent className="grid gap-6 p-6 sm:p-8">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-eyebrow text-brand-700 dark:text-brand-300">
                    {t('hero.previewEyebrow')}
                  </p>
                  <span className="size-2 rounded-full bg-brand-500" aria-hidden />
                </div>
                <p className="font-display text-h3 leading-tight tracking-tight text-foreground">
                  {t('hero.previewTitle')}
                </p>
                <Separator className="bg-border/60" />
                <div className="grid gap-4">
                  <PreviewLine index="01" text={t('hero.previewLines.profile')} />
                  <PreviewLine index="02" text={t('hero.previewLines.price')} />
                  <PreviewLine index="03" text={t('hero.previewLines.time')} />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="marketplace-quick-links container-page flex min-w-0 flex-col gap-3 border-t border-border py-5 text-small text-muted-foreground sm:flex-row sm:items-center sm:gap-5">
          <span className="font-medium text-foreground">{t('quickLinks.label')}</span>
          <div className="flex min-w-0 flex-wrap gap-2">
            {QUICK_CATEGORIES.map((category) => (
              <Link
                key={category}
                href={`/instructors?categories=${category}`}
                className="rounded-md border border-border px-3 py-1 transition-colors hover:border-brand-500 hover:text-foreground"
              >
                {t(`quickLinks.categories.${category}`)}
              </Link>
            ))}
            {QUICK_CITIES.map((city) => (
              <Link
                key={city.id}
                href={city.href}
                className="rounded-md border border-border px-3 py-1 transition-colors hover:border-brand-500 hover:text-foreground"
              >
                {t(`quickLinks.cities.${city.id}`)}
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section id="how" className="marketplace-how-section section scroll-mt-20">
        <div className="container-page grid min-w-0 gap-10 lg:grid-cols-[0.75fr_1.25fr] lg:gap-20">
          <header className="grid content-start gap-3">
            <p className="text-eyebrow">{t('how.eyebrow')}</p>
            <h2 className="font-display text-h2 leading-tight tracking-tight text-foreground">
              {t('how.title')}
            </h2>
            <p className="max-w-md text-body text-muted-foreground">{t('how.body')}</p>
          </header>
          <ol className="grid min-w-0 gap-4">
            <JourneyStep
              number="01"
              title={t('how.steps.choose.title')}
              body={t('how.steps.choose.body')}
            />
            <JourneyStep
              number="02"
              title={t('how.steps.compare.title')}
              body={t('how.steps.compare.body')}
            />
            <JourneyStep
              number="03"
              title={t('how.steps.book.title')}
              body={t('how.steps.book.body')}
            />
          </ol>
        </div>
      </section>

      <section className="marketplace-providers-section border-y border-border bg-muted">
        <div className="container-page section grid min-w-0 gap-7">
          <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-end sm:justify-between sm:gap-6">
            <div className="grid min-w-0 gap-2">
              <p className="text-eyebrow">{t('providers.eyebrow')}</p>
              <h2 className="font-display text-h2 leading-tight tracking-tight text-foreground">
                {t('providers.title')}
              </h2>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link href="/instructors">{t('providers.cta')}</Link>
            </Button>
          </div>
          <InstructorPreview limit={3} />
        </div>
      </section>

      <section className="marketplace-assurance-section section">
        <div className="container-page grid gap-7">
          <header className="grid gap-2">
            <p className="text-eyebrow">{t('assurance.eyebrow')}</p>
            <h2 className="max-w-2xl font-display text-h2 leading-tight tracking-tight text-foreground">
              {t('assurance.title')}
            </h2>
          </header>
          <div className="grid gap-4 md:grid-cols-3">
            <AssuranceCard
              title={t('assurance.cards.price.title')}
              body={t('assurance.cards.price.body')}
            />
            <AssuranceCard
              title={t('assurance.cards.safety.title')}
              body={t('assurance.cards.safety.body')}
            />
            <AssuranceCard
              title={t('assurance.cards.cancellation.title')}
              body={t('assurance.cards.cancellation.body')}
            />
          </div>
        </div>
      </section>

      <section className="marketplace-entry-section border-t border-border">
        <div className="container-page section grid min-w-0 gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-end">
          <div className="grid min-w-0 gap-3">
            <p className="text-eyebrow">{t('entry.eyebrow')}</p>
            <h2 className="font-display text-h2 leading-tight tracking-tight text-foreground">
              {t('entry.title')}
            </h2>
            <p className="max-w-xl text-body-lg text-muted-foreground">{t('entry.body')}</p>
          </div>
          <div className="flex min-w-0 flex-col gap-3 sm:flex-row lg:flex-col">
            <Button asChild size="lg">
              <Link href="/instructors">{t('entry.learnerCta')}</Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/for-instructors">{t('entry.providerCta')}</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="marketplace-footer border-t border-border bg-muted">
        <div className="container-page flex flex-col gap-4 py-8 text-small sm:flex-row sm:items-center sm:justify-between">
          <p className="text-muted-foreground">{t('footer.prompt')}</p>
          <nav className="flex flex-wrap gap-x-5 gap-y-2" aria-label={t('footer.label')}>
            <Link className="text-foreground underline-offset-4 hover:underline" href="/faq">
              {t('footer.faq')}
            </Link>
            <Link className="text-foreground underline-offset-4 hover:underline" href="/privacy">
              {t('footer.privacy')}
            </Link>
            <Link className="text-foreground underline-offset-4 hover:underline" href="/contact">
              {t('footer.contact')}
            </Link>
          </nav>
        </div>
      </section>
    </main>
  );
}

function PreviewLine({ index, text }: { index: string; text: string }) {
  return (
    <div className="grid grid-cols-[2.25rem_1fr] items-start gap-3">
      <span className="font-display text-small text-brand-700 dark:text-brand-300">{index}</span>
      <span className="text-small text-muted-foreground">{text}</span>
    </div>
  );
}

function JourneyStep({ number, title, body }: { number: string; title: string; body: string }) {
  return (
    <li className="grid grid-cols-[3.25rem_1fr] gap-4 border-b border-border pb-5 last:border-b-0 last:pb-0">
      <span className="flex size-11 items-center justify-center rounded-full border border-brand-500/45 bg-brand-100 font-display text-small font-semibold text-brand-700 shadow-sm dark:bg-brand-900 dark:text-brand-300">
        {number}
      </span>
      <div className="grid gap-1">
        <h3 className="font-display text-h4 tracking-tight text-foreground">{title}</h3>
        <p className="text-body text-muted-foreground">{body}</p>
      </div>
    </li>
  );
}

function AssuranceCard({ title, body }: { title: string; body: string }) {
  return (
    <Card className="surface-card lift border-border bg-card">
      <CardContent className="grid gap-3 p-5">
        <h3 className="font-display text-h4 tracking-tight text-foreground">{title}</h3>
        <p className="text-small leading-relaxed text-muted-foreground">{body}</p>
      </CardContent>
    </Card>
  );
}
