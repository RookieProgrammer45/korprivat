// @polsia:user-owned — compact live instructor rail.
//
// This island is shared by the home page and the provider-facing preview. It
// uses the same public list contract as the directory and links every card to
// the learner-facing profile, with no operational or social-proof metrics.

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
import { type InstructorFilteredItem, InstructorList } from '@/lib/contracts/instructors';

const MAX_PREVIEW_ROWS = 3;

type Status = 'loading' | 'ready' | 'empty' | 'error';

export function InstructorPreview({
  limit = MAX_PREVIEW_ROWS,
  pageIntro = false,
}: {
  limit?: number;
  pageIntro?: boolean;
}) {
  const tr = useTranslations('instructorPreview');
  const [status, setStatus] = useState<Status>('loading');
  const [rows, setRows] = useState<InstructorFilteredItem[]>([]);

  useEffect(() => {
    let active = true;
    apiFetch('/api/instructors', { schema: InstructorList })
      .then((data) => {
        if (!active) return;
        setRows(data.items.slice(0, Math.max(1, limit)));
        setStatus(data.items.length === 0 ? 'empty' : 'ready');
      })
      .catch(() => {
        if (!active) return;
        setStatus('error');
      });
    return () => {
      active = false;
    };
  }, [limit]);

  const content =
    status === 'loading' ? (
      <PreviewSkeleton limit={limit} />
    ) : status === 'error' ? (
      <p role="alert" className="text-small font-medium text-destructive">
        {tr('errorTitle')}
      </p>
    ) : status === 'empty' ? (
      <p className="text-small text-muted-foreground">{tr('empty')}</p>
    ) : (
      <ul className="grid min-w-0 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((row) => (
          <li key={row.id}>
            <PreviewCard row={row} />
          </li>
        ))}
      </ul>
    );

  if (!pageIntro) return content;

  return (
    <section className="grid min-w-0 gap-7">
      <header className="grid min-w-0 gap-2">
        <p className="text-eyebrow">{tr('pageEyebrow')}</p>
        <h1 className="font-display text-h1 leading-tight tracking-tight text-foreground">
          {tr('pageTitle')}
        </h1>
        <p className="max-w-2xl text-body-lg text-muted-foreground">{tr('pageBody')}</p>
      </header>
      {content}
      <div>
        <Button asChild size="lg">
          <Link href="/instructors">{tr('directoryCta')}</Link>
        </Button>
      </div>
    </section>
  );
}

function PreviewCard({ row }: { row: InstructorFilteredItem }) {
  const tr = useTranslations('instructorPreview');
  const trTier = useTranslations('cancellationPolicy.tierBadge');
  const trBooking = useTranslations('bookingForm');
  const locale = normalizeMarketplaceLocale(useLocale());
  const nextSlotPill = row.nextSlotAt ? formatNextSlotPill(row.nextSlotAt, locale, tr) : null;
  const mode = row.bookingMode === 'request' ? 'request' : 'instant';
  const tier = row.cancellationPolicyTier ?? 'flexible';
  return (
    <Link
      href={`/instructors/${row.id}`}
      className="marketplace-provider-card group block h-full min-w-0 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-brand-500/60"
    >
      <Card className="surface-card marketplace-preview-card lift h-full border-border bg-card transition-colors duration-200 group-hover:border-brand-500/40 group-hover:shadow-md">
        <CardContent className="flex h-full min-w-0 flex-col gap-4 p-5">
          <div className="marketplace-preview-card-header flex min-w-0 flex-wrap items-start justify-between gap-3">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <Image
                src={row.photoUrl}
                alt={tr('portraitAlt', { name: row.name })}
                width={48}
                height={48}
                unoptimized
                className="marketplace-provider-avatar size-12 shrink-0 rounded-full border border-brand-500/35 bg-brand-100 object-cover dark:bg-brand-900"
              />
              <div className="min-w-0">
                <p className="break-words font-display text-base font-semibold text-foreground">
                  {row.name}
                </p>
                <p className="break-words text-small text-muted-foreground">{row.city}</p>
              </div>
            </div>
            <Badge
              variant="secondary"
              className="marketplace-rate-badge max-w-full shrink-0 whitespace-normal bg-brand-100 text-brand-700 dark:bg-brand-900 dark:text-brand-300"
            >
              {formatSek(row.hourlyRateSek, locale, tr('rateSuffix'))}
            </Badge>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {row.categories.map((category) => (
              <Badge key={category} variant="outline" className="border-border text-foreground">
                {category}
              </Badge>
            ))}
          </div>

          <div className="grid min-w-0 gap-1 text-small text-muted-foreground">
            <span>
              {tr('nextAvailableLabel')}:{' '}
              <span className="font-medium text-foreground">
                {nextSlotPill?.label ?? tr('noUpcomingSlot')}
              </span>
            </span>
            <span>{row.englishSpeaking ? tr('englishAvailable') : tr('swedishAvailable')}</span>
          </div>

          <div className="mt-auto flex min-w-0 flex-wrap items-center gap-2 border-t border-border pt-4">
            <Badge variant="outline" className="border-border">
              {trBooking(`bookingModeLabel.${mode}`)}
            </Badge>
            <Badge variant="outline" className="border-border">
              {trTier(tier)}
            </Badge>
            <span className="ml-auto min-w-0 text-right text-small font-medium text-foreground">
              {tr('profileCta')} <span aria-hidden>→</span>
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function PreviewSkeleton({ limit }: { limit: number }) {
  const ids = Array.from(
    { length: Math.min(Math.max(1, limit), MAX_PREVIEW_ROWS) },
    (_, index) => `preview-skeleton-${index + 1}`,
  );
  return (
    <ul className="grid min-w-0 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {ids.map((skeletonId) => (
        <li key={skeletonId}>
          <Card className="surface-card border-border">
            <CardContent className="flex min-w-0 flex-col gap-5 p-6">
              <div className="flex items-center gap-3">
                <Skeleton className="size-12 rounded-full" />
                <div className="flex flex-1 flex-col gap-2">
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-3 w-1/3" />
                </div>
              </div>
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-5/6" />
            </CardContent>
          </Card>
        </li>
      ))}
    </ul>
  );
}

function formatNextSlotPill(
  iso: string,
  locale: 'en' | 'sv',
  t: ReturnType<typeof useTranslations<'instructorPreview'>>,
): { label: string; iso: string } {
  const parts = providerSlotDateParts(iso, locale);
  if (!parts) return { label: t('slotLabel'), iso };
  const when = parts.isWithinNextWeek
    ? t('slotTimeAndWeekday', { weekday: parts.weekday, time: parts.time })
    : `${t('slotMonthDay', { monthShort: parts.monthShort, day: parts.day })} · ${t('slotTime', { time: parts.time })}`;
  return { label: t('slotLabelRelative', { when }), iso };
}

function formatSek(amount: number, locale: 'en' | 'sv', suffix: string): string {
  return `${new Intl.NumberFormat(locale === 'sv' ? 'sv-SE' : 'en-GB').format(amount)} ${suffix}`;
}
