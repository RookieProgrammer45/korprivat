// @polsia:user-owned — student-dashboard island: AI-ranked instructor
// recommendations.
//
// Loads GET /api/instructors/recommendations (`apiFetch` only — never
// `await fetch`) and renders the matched instructor cards. When the
// learner has no category/city anchor yet the route returns
// `{ items: [] }`, which we treat as "the section is hidden" via
// `return null` — the brief's "hidden if no category/city set" affordance.
//
// The copy is translated through `useTranslations('dashboard.student')`
// because every other dashboard island lives under the same namespace.

'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { apiFetch } from '@/lib/api-client';
import {
  normalizeMarketplaceLocale,
  providerSlotDateParts,
} from '@/lib/business/marketplace-localization';
import {
  InstructorRecommendations,
  type RecommendedInstructor,
} from '@/lib/contracts/instructor-recommendations';

type State =
  | { kind: 'loading' }
  | { kind: 'error' }
  | { kind: 'ready'; items: RecommendedInstructor[] };

export function RecommendedInstructors() {
  const t = useTranslations('dashboard.student.recommended');
  const locale = normalizeMarketplaceLocale(useLocale());
  const [state, setState] = useState<State>({ kind: 'loading' });
  // Bumped from the Retry handler so the fetch effect fires again.
  const [retryNonce, setRetryNonce] = useState(0);

  useEffect(() => {
    let active = true;
    setState({ kind: 'loading' });
    // `retryNonce` is a ticks-only trigger bumped by the Retry button —
    // it re-runs this effect without changing the request URL.
    void retryNonce;
    // Locale is read by the API from the cookie; this reference makes the
    // locale toggle re-fetch the server-generated recommendation copy.
    void locale;
    apiFetch('/api/instructors/recommendations', { schema: InstructorRecommendations })
      .then((data) => {
        if (!active) return;
        setState({ kind: 'ready', items: data.items });
      })
      .catch(() => {
        if (!active) return;
        setState({ kind: 'error' });
      });
    return () => {
      active = false;
    };
  }, [locale, retryNonce]);

  if (state.kind === 'loading') {
    return <Skeleton className="h-48 w-full rounded-lg" />;
  }

  // Empty list = "no category/city yet" — hide the section rather than
  // draw an empty placeholder.
  if (state.kind === 'ready' && state.items.length === 0) {
    return null;
  }

  if (state.kind === 'error') {
    return (
      <Card className="border-brand-500/40 bg-brand-100 dark:bg-brand-900">
        <CardContent className="flex flex-col gap-3 p-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-small text-brand-700 dark:text-brand-300">{t('errorTitle')}</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setRetryNonce((n) => n + 1)}
            className="border-brand-500/40"
          >
            {t('retry')}
          </Button>
        </CardContent>
      </Card>
    );
  }

  // state.kind === 'ready' && items.length > 0
  const items = state.items;

  return (
    <section className="grid gap-4">
      <header className="grid gap-1">
        <p className="text-eyebrow text-muted-foreground">{t('eyebrow')}</p>
        <h2 className="font-display text-h3 leading-tight tracking-tight text-foreground">
          {t('title')}
        </h2>
        <p className="max-w-2xl text-small text-muted-foreground">{t('lead')}</p>
      </header>
      <ul className="grid gap-4 sm:grid-cols-2">
        {items.map((row) => (
          // Re-key by id; stable across re-orders.
          <li key={row.id}>
            <RecommendationCard row={row} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function RecommendationCard({ row }: { row: RecommendedInstructor }) {
  const t = useTranslations('dashboard.student.recommended');
  const locale = normalizeMarketplaceLocale(useLocale());
  const nextSlotLabel = row.nextSlotAt ? formatNextSlotPill(row.nextSlotAt, locale) : null;
  const reason = row.reason;

  return (
    <Card className="surface-card h-full border-border bg-card transition-colors duration-200 hover:border-brand-500/40 hover:shadow-md">
      <CardContent className="flex flex-col gap-4 p-6">
        <div className="flex items-start gap-3">
          <Image
            src={row.photoUrl}
            alt={t('portraitAlt', { name: row.name })}
            width={48}
            height={48}
            unoptimized
            className="size-12 shrink-0 rounded-full border border-brand-500/30 bg-brand-100 object-cover dark:bg-brand-900"
          />
          <div className="grid flex-1 gap-0.5">
            <span className="font-display text-base font-semibold text-foreground">{row.name}</span>
            <span className="text-small text-muted-foreground">{row.city}</span>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <Badge className="border-brand-500/40 bg-brand-100 text-brand-700 dark:bg-brand-900 dark:text-brand-300">
                {formatPercent(row.score, locale)}%
              </Badge>
              {row.englishSpeaking ? (
                <Badge variant="outline" className="border-border text-foreground">
                  {t('englishAvailable')}
                </Badge>
              ) : null}
              {nextSlotLabel ? (
                <span
                  className="inline-flex items-center rounded-md border border-brand-500/40 bg-brand-100 px-2.5 py-0.5 text-[11px] font-medium text-brand-700 dark:bg-brand-900 dark:text-brand-300"
                  title={row.nextSlotAt ?? ''}
                >
                  {t('nextSlot', { when: nextSlotLabel })}
                </span>
              ) : null}
            </div>
          </div>
        </div>

        <p className="text-small text-muted-foreground line-clamp-2">{reason}</p>

        <div className="flex flex-wrap gap-1.5">
          {row.categories.map((code) => (
            <Badge key={code} variant="outline" className="border-border text-foreground">
              {code}
            </Badge>
          ))}
        </div>

        <div className="flex items-center justify-between border-t border-border pt-4">
          <span className="font-display font-semibold text-foreground">
            {formatSek(row.hourlyRateSek, locale, t('rateSuffix'))}
          </span>
          <Button asChild variant="ghost" size="sm">
            <Link href={`/instructors/${row.id}`}>{t('viewProfile')}</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function formatNextSlotPill(iso: string, locale: 'en' | 'sv'): string {
  const parts = providerSlotDateParts(iso, locale);
  if (!parts) return iso;
  return parts.isWithinNextWeek
    ? `${parts.weekday} ${parts.time}`
    : `${parts.monthShort} ${parts.day} · ${parts.time}`;
}

function formatSek(amount: number, locale: 'en' | 'sv', suffix: string): string {
  return `${new Intl.NumberFormat(locale === 'sv' ? 'sv-SE' : 'en-GB').format(amount)} ${suffix}`;
}

function formatPercent(value: number, locale: 'en' | 'sv'): string {
  return new Intl.NumberFormat(locale === 'sv' ? 'sv-SE' : 'en-GB', {
    maximumFractionDigits: 0,
  }).format(value * 100);
}
