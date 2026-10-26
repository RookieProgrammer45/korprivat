// Shared Google-review list. Used on the school profile (full) and on
// directory / home / comparison cards (compact snippets). Rows come from
// the public instructor payload — never invented, never scraped here.
// Attribution ("Källa: Google" + optional Maps link) stays visible.

'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export type GoogleReviewQuote = {
  id: string;
  authorName: string;
  rating: number;
  comment: string;
  relativeTime?: string | null;
  publishTime?: string | null;
};

export function GoogleReviewQuotes({
  items,
  average,
  count,
  mapsUri,
  limit,
  compact = false,
}: {
  items: GoogleReviewQuote[];
  average?: number | null;
  count?: number | null;
  mapsUri?: string | null;
  limit?: number;
  compact?: boolean;
}) {
  const t = useTranslations('googleReviews');
  const locale = useLocale();
  const visible = items.slice(0, limit ?? items.length);
  if (visible.length === 0 && (average == null || !count)) return null;

  return (
    <section className={compact ? 'grid min-w-0 gap-2' : 'grid min-w-0 gap-3'}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <GoogleG />
          <p className={compact ? 'text-caption font-medium text-foreground' : 'text-eyebrow'}>
            {t('heading')}
          </p>
        </div>
        {mapsUri ? (
          <a
            href={mapsUri}
            target="_blank"
            rel="noopener noreferrer"
            className="text-caption font-medium text-brand-700 underline-offset-2 hover:underline dark:text-brand-300"
            onClick={(event) => event.stopPropagation()}
          >
            {t('viewAll')} ↗
          </a>
        ) : null}
      </div>

      {average != null && count != null && count > 0 ? (
        <p className="text-small font-semibold text-foreground">
          {t('summaryText', {
            average: formatNumber(average, locale),
            count,
          })}
        </p>
      ) : null}

      {visible.length > 0 ? (
        <ul className="grid min-w-0 gap-2">
          {visible.map((review) => (
            <li key={review.id}>
              <GoogleReviewCard review={review} compact={compact} />
            </li>
          ))}
        </ul>
      ) : null}

      <p className="text-caption text-muted-foreground">{t('source')}</p>
    </section>
  );
}

function GoogleReviewCard({ review, compact }: { review: GoogleReviewQuote; compact: boolean }) {
  const t = useTranslations('googleReviews');
  const locale = useLocale();
  const [expanded, setExpanded] = useState(false);
  const clamp = compact ? 160 : 320;
  const isLong = review.comment.length > clamp;
  const whenLabel = review.publishTime
    ? formatDay(review.publishTime, locale)
    : review.relativeTime;

  return (
    <blockquote className="min-w-0 rounded-lg border border-border bg-muted p-3">
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
        className={`mt-2 whitespace-pre-line text-small text-foreground ${
          isLong && !expanded ? (compact ? 'line-clamp-3' : 'line-clamp-5') : ''
        }`}
      >
        {review.comment}
      </p>
      {isLong && !compact ? (
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
    </blockquote>
  );
}

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
