//
// Frontstage: the price, then the schools. Policy stays on the terms page.

'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { HomeHero } from '@/components/custom/home-hero';
import { InstructorPreview } from '@/components/custom/instructor-preview';

export function PublicHome() {
  const t = useTranslations('publicHome');

  return (
    <main className="marketplace-home relative isolate w-full min-w-0">
      <HomeHero />

      <section className="border-t border-border">
        <div className="container-page grid min-w-0 gap-6 py-10 lg:py-14">
          <div className="flex min-w-0 items-end justify-between gap-4">
            <h2 className="font-display text-h2 font-normal leading-tight tracking-tight text-foreground">
              {t('providers.title')}
            </h2>
            <Link href="/instructors" className="dlu-text-link shrink-0">
              {t('providers.cta')}
            </Link>
          </div>
          <InstructorPreview limit={3} showContact={false} />
        </div>
      </section>

      <section className="border-t border-border">
        <div className="container-page flex min-w-0 flex-col items-start gap-4 py-12 lg:py-16 sm:flex-row sm:items-center">
          <Link href="/instructors" className="dlu-ink-pill">
            {t('entry.learnerCta')}
          </Link>
          <Link href="/for-skolor" className="dlu-text-link">
            {t('entry.providerCta')}
          </Link>
        </div>
      </section>
    </main>
  );
}
