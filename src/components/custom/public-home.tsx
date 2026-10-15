//
// The page deliberately answers only the questions that move a learner toward
// a booking: what is available, what it costs, how the next step works, and
// where to find safety, cancellation, and support details.

'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { InstructorPreview } from '@/components/custom/instructor-preview';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { apiFetch } from '@/lib/api-client';
import { type InstructorFilteredItem, InstructorList } from '@/lib/contracts/instructors';

const QUICK_CATEGORIES = ['B', 'A', 'BE'] as const;
const QUICK_CITIES = [
  { id: 'stockholm', href: '/locations/se/stockholm' },
  { id: 'goteborg', href: '/locations/se/goteborg' },
  { id: 'malmo', href: '/locations/se/malmo' },
  { id: 'vasteras', href: '/locations/se/vasteras' },
] as const;

const LANGUAGE_LABELS: Record<string, string> = {
  sv: 'Svenska',
  en: 'Engelska',
  ar: 'Arabiska',
  fa: 'Persiska',
  so: 'Somaliska',
  pl: 'Polska',
  es: 'Spanska',
  de: 'Tyska',
  tr: 'Turkiska',
  fr: 'Franska',
  ur: 'Urdu',
  fi: 'Finska',
  no: 'Norska',
  da: 'Danska',
};

type DeckProfile = {
  id: string;
  name: string;
  type: 'Skola' | 'Instruktör';
  city: string;
  chip: string | null;
  rating: string | null;
  reviews: string | null;
  languages: string;
  nextSlot: string | null;
  href: string;
};

const FALLBACK_PROFILES: DeckProfile[] = [
  {
    id: 'fallback-globen',
    name: 'Globens Trafikskolan',
    type: 'Skola',
    city: 'Stockholm',
    chip: 'fr. 299 kr',
    rating: '4.9',
    reviews: '1 403 omdömen',
    languages: 'Svenska · Engelska',
    nextSlot: 'tis 10:00',
    href: '/instructors',
  },
  {
    id: 'fallback-ari',
    name: 'Ari Shoval',
    type: 'Instruktör',
    city: 'Sollentuna',
    chip: 'fr. 350 kr',
    rating: null,
    reviews: null,
    languages: 'Svenska · Engelska · Arabiska',
    nextSlot: null,
    href: '/instructors',
  },
  {
    id: 'fallback-korhu',
    name: 'Körkortshuset i Sollentuna',
    type: 'Skola',
    city: 'Sollentuna',
    chip: 'fr. 350 kr',
    rating: null,
    reviews: null,
    languages: 'Svenska',
    nextSlot: null,
    href: '/instructors',
  },
];

const MAX_DECK_PROFILES = 6;
const ROTATION_MS = 4800;

function formatSekChip(rate: number | null): string | null {
  return typeof rate === 'number' ? `fr. ${rate} kr` : null;
}

function formatSlot(iso: string): string | null {
  try {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return null;
    return new Intl.DateTimeFormat('sv-SE', {
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  } catch {
    return null;
  }
}

function toDeckProfile(row: InstructorFilteredItem): DeckProfile {
  const languages = (row.languages ?? [])
    .map((code) => LANGUAGE_LABELS[code] ?? code.toUpperCase())
    .join(' · ');
  const rating = row.reviewSummary?.averageRating;
  return {
    id: row.id,
    name: row.name,
    type: row.providerType === 'INSTRUCTOR' ? 'Instruktör' : 'Skola',
    city: row.city,
    chip: formatSekChip(row.hourlyRateSek),
    rating: typeof rating === 'number' ? rating.toFixed(1) : null,
    reviews:
      row.reviewSummary && row.reviewSummary.count > 0
        ? `${row.reviewSummary.count} omdömen`
        : null,
    languages: languages || 'Svenska',
    nextSlot: row.nextSlotAt ? formatSlot(row.nextSlotAt) : null,
    href: `/instructors/${row.id}`,
  };
}

export function PublicHome() {
  const t = useTranslations('publicHome');
  const [profiles, setProfiles] = useState<DeckProfile[]>(FALLBACK_PROFILES);
  const [live, setLive] = useState(false);
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    let alive = true;
    apiFetch('/api/instructors', { schema: InstructorList })
      .then((data) => {
        if (!alive) return;
        const rows = data.items.slice(0, MAX_DECK_PROFILES).map(toDeckProfile);
        if (rows.length > 0) {
          setProfiles(rows);
          setActive(0);
          setLive(true);
        }
      })
      .catch(() => {
        if (!alive) return;
      });
    return () => {
      alive = false;
    };
  }, []);

  const count = profiles.length;
  const front = profiles[active % count];
  const back1 = count > 1 ? profiles[(active + 1) % count] : undefined;
  const back2 = count > 2 ? profiles[(active + 2) % count] : undefined;

  useEffect(() => {
    if (paused || count < 2) return;
    if (typeof window === 'undefined') return;
    const timer = window.setInterval(() => {
      setActive((current) => (current + 1) % count);
    }, ROTATION_MS);
    return () => {
      window.clearInterval(timer);
    };
  }, [paused, count]);

  if (!front) return null;

  const go = (step: number) => {
    setActive((current) => (current + step + count) % count);
  };

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
            <p className="max-w-2xl min-w-0 text-body-lg text-muted-foreground">
              {t('hero.body').startsWith('DriveLinkUp') ? (
                <>
                  <strong className="font-bold text-foreground">DriveLinkUp</strong>
                  {t('hero.body').slice('DriveLinkUp'.length)}
                </>
              ) : (
                t('hero.body')
              )}
            </p>
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

          <div className="marketplace-reveal relative min-w-0 lg:min-h-[720px]">
            <div className="marketplace-hero-panel absolute inset-0 hidden overflow-hidden bg-white lg:block dark:bg-black">
              <p className="dlu-tag">{t('hero.marketplaceTag')}</p>
              {/* biome-ignore lint/a11y/noStaticElementInteractions: dekorativ hover-paus for kortspel - grafik, ej interaktiv kontroll */}
              <div
                className="dlu-deck"
                onMouseEnter={() => setPaused(true)}
                onMouseLeave={() => setPaused(false)}
              >
                <article className="dlu-card" key={front.id}>
                  <div className="dlu-top">
                    <div className="min-w-0">
                      <p className="dlu-type">{front.type}</p>
                      <p className="dlu-name">{front.name}</p>
                      <p className="dlu-city">{front.city}</p>
                    </div>
                    {front.chip ? <span className="dlu-chip">{front.chip}</span> : null}
                  </div>
                  {front.rating ? (
                    <p className="dlu-meta">
                      <i aria-hidden />
                      {front.rating}
                      {front.reviews ? ` · ${front.reviews}` : ''}
                    </p>
                  ) : null}
                  <p className="dlu-lang">{front.languages}</p>
                  <div className="dlu-row">
                    <span className="dlu-slot">
                      Nästa lediga tid
                      <b>{front.nextSlot ?? 'På förfrågan'}</b>
                    </span>
                    <Link href={front.href} className="dlu-btn">
                      Boka
                    </Link>
                  </div>
                </article>
                {back1 ? (
                  <article className="dlu-card dlu-back-1" key={back1.id}>
                    <div className="dlu-top">
                      <div className="min-w-0">
                        <p className="dlu-type">{back1.type}</p>
                        <p className="dlu-name">{back1.name}</p>
                        <p className="dlu-city">{back1.city}</p>
                      </div>
                      {back1.chip ? <span className="dlu-chip">{back1.chip}</span> : null}
                    </div>
                    <p className="dlu-lang">{back1.languages}</p>
                  </article>
                ) : null}
                {back2 ? (
                  <article className="dlu-card dlu-back-2" key={back2.id}>
                    <div className="dlu-top">
                      <div className="min-w-0">
                        <p className="dlu-type">{back2.type}</p>
                        <p className="dlu-name">{back2.name}</p>
                        <p className="dlu-city">{back2.city}</p>
                      </div>
                      {back2.chip ? <span className="dlu-chip">{back2.chip}</span> : null}
                    </div>
                  </article>
                ) : null}
              </div>
              <div className="dlu-nav">
                <button
                  type="button"
                  className="dlu-nav-btn"
                  aria-label="Föregående profil"
                  onClick={() => go(-1)}
                >
                  ←
                </button>
                <button
                  type="button"
                  className="dlu-nav-btn"
                  aria-label="Nästa profil"
                  onClick={() => go(1)}
                >
                  →
                </button>
              </div>
              <div className="dlu-dots">
                {profiles.map((profile, index) => (
                  <button
                    type="button"
                    key={profile.id}
                    className={index === active ? 'dlu-dot dlu-on' : 'dlu-dot'}
                    aria-label={`Visa ${profile.name}`}
                    onClick={() => setActive(index)}
                  />
                ))}
              </div>
              <p className="dlu-count">
                {live ? `${count} profiler just nu` : 'Alla profiler just nu'}
              </p>
              <p className="dlu-arrow-note">jämför → boka → kör</p>
              <p className="dlu-free">
                <i aria-hidden />
                Kostnadsfritt för elever
              </p>
            </div>
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
