//
// The page deliberately answers only the questions that move a learner toward
// a booking: what is available, what it costs, how the next step works, and
// where to find safety, cancellation, and support details.

'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { HomeHero } from '@/components/custom/home-hero';
import { InstructorPreview } from '@/components/custom/instructor-preview';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export function PublicHome() {
  const t = useTranslations('publicHome');

  return (
    <main className="marketplace-home relative isolate w-full min-w-0">
      <HomeHero />

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
              <Link href="/for-skolor">{t('entry.providerCta')}</Link>
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
