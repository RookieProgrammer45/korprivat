// Google-reviews section on the public instructor detail page. Owns ONLY
// the read path (GET) — rows are written by the weekly Google backfill job,
// so there is no form/POST here. Mirrors ReviewSection's client-island
// pattern (fetch on mount, full loading/empty/error triad) but renders
// NOTHING while loading, on error, or when the school has no Google data
// yet — an empty section must never occupy layout on a live page.
//
// Google attribution stays visible (logo + "Källa: Google" + link to the
// Maps listing) per Google's review-display guidelines; the copy comes
// from the `googleReviews` message namespace (sv + en).

'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { apiFetch } from '@/lib/api-client';
import {
  type GoogleReviewItem,
  GoogleReviewList,
  type GoogleReviewSummary,
} from '@/lib/contracts/google-reviews';

type State =
  | { kind: 'hidden' }
  | { kind: 'ready'; items: GoogleReviewItem[]; summary: GoogleReviewSummary | null };

export function GoogleReviewsSection({ instructorId }: { instructorId: string }) {
  const t = useTranslations('googleReviews');
  const locale = useLocale();
  const [state, setState] = useState<State>({ kind: 'hidden' });

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const data = await apiFetch(
          `/api/instructors/${encodeURIComponent(instructorId)}/google-reviews`,
          { schema: GoogleReviewList },
        );
        if (!active) return;
        if (data.items.length === 0 && data.summary === null) {
          setState({ kind: 'hidden' });
          return;
        }
        setState({ kind: 'ready', items: data.items, summary: data.summary });
      } catch {
        if (!active) return;
        setState({ kind: 'hidden' });
      }
    })();
    return () => {
      active = false;
    };
  }, [instructorId]);

  if (state.kind !== 'ready') return null;

  return (
    <Card className="border-border bg-background">
      <CardContent className="flex flex-col gap-3 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <GoogleG />
            <p className="text-eyebrow">{t('heading')}</p>
          </div>
          {state.summary?.mapsUri ? (
            <a
              href={state.summary.mapsUri}
              target="_blank"
              rel="noopener noreferrer"
              className="text-small font-medium text-brand-700 underline-offset-2 hover:underline dark:text-brand-300"
            >
              {t('viewAll')} ↗
            </a>
          ) : null}
        </div>

        {state.summary ? (
          <p className="text-small font-semibold text-foreground">
            {t('summaryText', {
              average: formatNumber(state.summary.rating, locale),
              count: state.summary.count,
            })}
          </p>
        ) : null}

        {state.items.length > 0 ? (
          <div className="grid gap-3">
            {state.items.map((review) => (
              <GoogleReviewCard key={review.id} review={review} />
            ))}
          </div>
        ) : null}

        <p className="text-caption text-muted-foreground">
          {t('source')}
          {state.summary?.syncedAt
            ? ` · ${t('syncedAt', { date: formatDay(state.summary.syncedAt, locale) })}`
            : ''}
        </p>
      </CardContent>
    </Card>
  );
}

function GoogleReviewCard({ review }: { review: GoogleReviewItem }) {
  const t = useTranslations('googleReviews');
  const locale = useLocale();
  const [expanded, setExpanded] = useState(false);
  const isLong = review.comment.length > 320;
  const whenLabel = review.publishTime
    ? formatDay(review.publishTime, locale)
    : review.relativeTime;

  return (
    <div className="min-w-0 rounded-lg border border-border bg-muted p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="min-w-0 break-words text-small font-semibold text-foreground">
          {review.authorName}
        </p>
        <Badge
          variant="secondary"
          aria-label={t('reviewRating', { rating: review.rating })}
          className="shrink-0 bg-brand-100 text-brand-700 hover:bg-brand-200 dark:bg-brand-900 dark:text-brand-300 dark:hover:bg-brand-800"
        >
          {`★ ${formatNumber(review.rating, locale)}`}
        </Badge>
      </div>
      {whenLabel ? <p className="mt-0.5 text-caption text-muted-foreground">{whenLabel}</p> : null}
      <p
        className={`mt-2 whitespace-pre-line text-body text-foreground ${
          isLong && !expanded ? 'line-clamp-5' : ''
        }`}
      >
        {review.comment}
      </p>
      {isLong ? (
        <Button
          type="button"
          variant="link"
          size="sm"
          className="mt-1 h-auto p-0 text-small"
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded ? t('showLess') : t('showMore')}
        </Button>
      ) : null}
    </div>
  );
}

// Standard four-colour Google "G" — kept inline (no remote asset, no
// next/image config) at 16px so the attribution reads as Google's mark.
function GoogleG() {
  return (
    <svg
      aria-hidden="true"
      role="presentation"
      focusable="false"
      width="16"
      height="16"
      viewBox="0 0 24 24"
    >
      <path
        fill="#4285F4"
        d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47a5.57 5.57 0 0 1-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09A11.99 11.99 0 0 0 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.27 14.29A7.2 7.2 0 0 1 4.89 12c0-.8.14-1.57.38-2.29V6.62H1.29a11.99 11.99 0 0 0 0 10.76l3.98-3.09z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42A11.97 11.97 0 0 0 12 0 11.99 11.99 0 0 0 1.29 6.62l3.98 3.09C6.22 6.86 8.87 4.75 12 4.75z"
      />
    </svg>
  );
}

// Local mirrors of the directory/detail formatters (same sv-SE / en-GB
// split the other islands use).
function formatNumber(value: number, locale: string): string {
  return new Intl.NumberFormat(locale === 'sv' ? 'sv-SE' : 'en-GB', {
    maximumFractionDigits: 1,
  }).format(value);
}

function formatDay(iso: string, locale: string): string {
  return new Intl.DateTimeFormat(locale === 'sv' ? 'sv-SE' : 'en-GB', {
    dateStyle: 'medium',
    timeZone: 'Europe/Stockholm',
  }).format(new Date(iso));
}
