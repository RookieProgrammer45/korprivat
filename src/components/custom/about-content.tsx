'use client';

// Om oss — port of the approved "The Sage" about page (v5, live tokens).
// Section copy lives in messages (aboutPage.*) so the locale switcher works;
// furniture styles live in custom-style.css §17.

import { ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';

const CHIP_IDS = ['0', '1', '2'] as const;
const PILLAR_IDS = ['0', '1', '2'] as const;
const FACT_IDS = ['0', '1', '2'] as const;

export function AboutContent() {
  const t = useTranslations('aboutPage');

  return (
    <main className="container-page section">
      <div className="mx-auto grid max-w-3xl gap-12">
        <header className="grid gap-4">
          <p className="text-eyebrow text-muted-foreground">{t('hero.eyebrow')}</p>
          <h1 className="font-display text-h1 leading-tight tracking-tight text-foreground">
            {t('hero.title')}
          </h1>
          <p className="text-body-lg text-foreground/90">{t('hero.intro')}</p>
          <div className="flex flex-wrap gap-2">
            {CHIP_IDS.map((id) => (
              <span key={id} className="dlu-about-chip">
                {t(`hero.chips.${id}`)}
              </span>
            ))}
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            <Link href="/instructors" className="dlu-footer-cta">
              {t('hero.primaryCta')}
              <ArrowRight className="size-4" aria-hidden />
            </Link>
            <Link href="/#how" className="dlu-about-ghost-cta">
              {t('hero.secondaryCta')}
            </Link>
          </div>
        </header>

        <section className="grid gap-3">
          <h2 className="font-display text-h3 leading-snug tracking-tight text-foreground">
            {t('linkStory.title')}
          </h2>
          <p className="text-body text-foreground/90">{t('linkStory.body')}</p>
          <div className="flex flex-wrap gap-2">
            <span className="dlu-about-chip">{t('linkStory.learner')}</span>
            <span className="dlu-about-chip">{t('linkStory.school')}</span>
          </div>
        </section>

        <section className="grid gap-3">
          <h2 className="font-display text-h2 leading-tight tracking-tight text-foreground">
            {t('origin.title')}
          </h2>
          <p className="text-body text-foreground/90">{t('origin.body')}</p>
          <p className="text-body text-foreground/90">{t('origin.body2')}</p>
          <ul className="grid list-disc gap-1 pl-5 marker:text-muted-foreground/70">
            {PILLAR_IDS.map((id) => (
              <li key={id} className="leading-relaxed">
                {t(`origin.pillars.${id}`)}
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-2">
            {FACT_IDS.map((id) => (
              <span key={id} className="dlu-about-chip">
                {t(`origin.facts.${id}`)}
              </span>
            ))}
          </div>
          <p className="text-body text-foreground/90">{t('origin.closing')}</p>
        </section>

        <section className="dlu-about-promise">
          <p className="text-eyebrow text-muted-foreground">{t('promise.eyebrow')}</p>
          <p className="font-display text-h3 leading-snug tracking-tight text-foreground">
            {t('promise.title')}
          </p>
          <p className="text-body text-foreground/90">{t('promise.body')}</p>
        </section>

        <section className="dlu-about-promise">
          <p className="text-eyebrow text-muted-foreground">{t('final.eyebrow')}</p>
          <h2 className="font-display text-h2 leading-tight tracking-tight text-foreground">
            {t('final.title')}
          </h2>
          <p className="text-body text-foreground/90">{t('final.body')}</p>
          <div className="flex flex-wrap gap-2 pt-1">
            <Link href="/instructors" className="dlu-footer-cta">
              {t('final.primaryCta')}
              <ArrowRight className="size-4" aria-hidden />
            </Link>
            <Link href="/for-instructors" className="dlu-about-ghost-cta">
              {t('final.secondaryCta')}
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
