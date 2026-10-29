//
// This island is shared by the home page and the provider-facing preview. It
// uses the same public list contract as the directory and links every card to
// the learner-facing profile, with no operational or social-proof metrics.

'use client';

import Image from 'next/image';
import Link from 'next/link';
import { type SchoolHeavyAdvertised, schoolPortraitUrl } from '@/lib/discovery/school-portrait';
import { SchoolMarkFallback } from '@/components/custom/school-mark-fallback';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { GoogleReviewQuotes } from '@/components/custom/google-review-quotes';
import { PublishedLessonPrice } from '@/components/custom/published-price';
import { SchoolContactActions } from '@/components/custom/school-contact-button';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { apiFetch } from '@/lib/api-client';
import {
  normalizeMarketplaceLocale,
  providerSlotDateParts,
} from '@/lib/business/marketplace-localization';
import { type InstructorFilteredItem, InstructorList } from '@/lib/contracts/instructors';
import { schoolPath } from '@/lib/seo/school-slugs';

const MAX_PREVIEW_ROWS = 20;

type Status = 'loading' | 'ready' | 'empty' | 'error';

export function InstructorPreview({
  limit = MAX_PREVIEW_ROWS,
  pageIntro = false,
  showContact = true,
  initialRows,
}: {
  limit?: number;
  pageIntro?: boolean;
  showContact?: boolean;
  /** Schools already rendered by the server. When set, the card does not fetch again. */
  initialRows?: InstructorFilteredItem[];
}) {
  const tr = useTranslations('instructorPreview');
  const seeded = initialRows !== undefined;
  const [status, setStatus] = useState<Status>(
    seeded ? (initialRows.length > 0 ? 'ready' : 'empty') : 'loading',
  );
  const [rows, setRows] = useState<InstructorFilteredItem[]>(initialRows ?? []);

  useEffect(() => {
    if (seeded) return;
    let active = true;
    apiFetch(`/api/instructors?limit=${Math.max(1, limit)}`, { schema: InstructorList })
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
  }, [limit, seeded]);

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
      <ul className="grid min-w-0 grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4">
        {rows.map((row) => (
          <li
            key={row.id}
            className={
              showContact ? 'grid h-full min-w-0 grid-rows-[1fr_auto] gap-2' : 'h-full min-w-0'
            }
          >
            <PreviewCard row={row} />
            {showContact ? (
              <div className="grid gap-2">
                <SchoolContactActions
                  name={row.name}
                  contact={row.contact}
                  priceRequest={row.priceRequest}
                  listing={schoolPath(row)}
                  size="sm"
                  className="w-full"
                />
              </div>
            ) : null}
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
  const locale = normalizeMarketplaceLocale(useLocale());
  const showTimes = row.surfaces?.availabilityDisplay === true;
  const nextSlotPill =
    showTimes && row.nextSlotAt ? formatNextSlotPill(row.nextSlotAt, locale, tr) : null;
  return (
    <Link
      href={`/instructors/${row.id}`}
      className="group block h-full min-w-0 rounded-[1.25rem] outline-none focus-visible:ring-2 focus-visible:ring-foreground/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      data-provider-type={row.providerType}
    >
      <article className="flex h-full min-w-0 flex-col overflow-hidden rounded-xl border border-border bg-white shadow-sm transition-[transform,box-shadow,border-color] duration-200 group-hover:-translate-y-0.5 group-hover:border-foreground/20 group-hover:shadow-md motion-reduce:transition-none motion-reduce:group-hover:translate-y-0 sm:rounded-[1.25rem] dark:bg-card">
        <SchoolMark
          name={row.name}
          photoUrl={row.photoUrl}
          categories={row.categories}
          heavy={row.publishedPrices?.heavy ?? null}
          alt={tr('portraitAlt', { name: row.name })}
          size="cover"
        />
        <div className="flex flex-1 flex-col gap-2 p-3 sm:gap-3 sm:p-5">
          <div className="min-w-0">
            <p className="text-[11px] leading-snug text-muted-foreground sm:text-small">
              {row.phone ? `${row.city} · ${row.phone.display}` : row.city}
            </p>
            <h3 className="line-clamp-2 break-words font-display text-sm font-normal leading-snug tracking-tight text-foreground sm:text-h4 sm:leading-normal">
              {row.name}
            </h3>
          </div>
          {row.publishedPrices?.lesson ? (
            <PublishedLessonPrice prices={row.publishedPrices} />
          ) : null}
          <div className="mt-auto flex flex-wrap gap-2">
            {row.categories.map((category) => (
              <span key={category} className="dlu-chip">
                {categoryChipLabel(tr(`category.${category}`), category)}
              </span>
            ))}
            {row.englishSpeaking ? (
              <span className="dlu-chip">{tr('englishAvailable')}</span>
            ) : null}
          </div>
          {nextSlotPill ? (
            <p className="text-small text-muted-foreground">{nextSlotPill.label}</p>
          ) : null}
          {(row.googleReviews?.length ?? 0) > 0 ? (
            <GoogleReviewQuotes
              items={row.googleReviews ?? []}
              average={row.googleRating}
              count={row.googleReviewCount}
              limit={1}
              compact
            />
          ) : null}
        </div>
      </article>
    </Link>
  );
}

export function SchoolMark({
  name,
  photoUrl,
  categories,
  heavy = null,
  heavyScope = false,
  alt,
  size,
}: {
  name: string;
  photoUrl: string;
  categories: readonly string[];
  heavy?: SchoolHeavyAdvertised | null;
  heavyScope?: boolean;
  alt: string;
  size: 'cover' | 'avatar';
}) {
  const [failed, setFailed] = useState(false);
  const portrait = schoolPortraitUrl(photoUrl);
  const photograph = portrait !== null && !failed;
  if (!photograph) {
    return (
      <SchoolMarkFallback
        name={name}
        categories={categories}
        heavy={heavy}
        heavyScope={heavyScope}
        iconClassName={
          size === 'cover' ? 'size-6 sm:size-9 lg:size-11' : 'size-5 sm:size-6'
        }
        className={
          size === 'cover'
            ? 'dlu-school-photo dlu-school-photo--compact flex items-center justify-center font-display text-lg font-normal text-foreground sm:text-4xl'
            : 'flex size-12 shrink-0 items-center justify-center rounded-full border border-border bg-[#ece9e2] font-display text-sm font-normal text-foreground dark:bg-[#1a1a18]'
        }
      />
    );
  }
  if (size === 'avatar') {
    return (
      <Image
        src={portrait ?? ''}
        alt={alt}
        width={48}
        height={48}
        unoptimized
        onError={() => setFailed(true)}
        className="size-12 shrink-0 rounded-full border border-border bg-white object-contain p-1.5"
      />
    );
  }
  return (
    <span className="dlu-school-photo">
      <Image
        src={portrait ?? ''}
        alt={alt}
        fill
        unoptimized
        sizes="(min-width: 1024px) 24rem, 100vw"
        onError={() => setFailed(true)}
        className="object-contain p-8"
      />
    </span>
  );
}

// Named categories read "Bil · B" so the chip matches the search field;
// codes without a name (AM, A1, A2) stay as the bare code.
export function categoryChipLabel(label: string, code: string): string {
  return label === code ? code : `${label} · ${code}`;
}

function PreviewSkeleton({ limit }: { limit: number }) {
  const ids = Array.from(
    { length: Math.min(Math.max(1, limit), MAX_PREVIEW_ROWS) },
    (_, index) => `preview-skeleton-${index + 1}`,
  );
  return (
    <ul className="grid min-w-0 grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4">
      {ids.map((skeletonId) => (
        <li key={skeletonId} aria-hidden>
          <div className="flex h-full min-w-0 flex-col overflow-hidden rounded-xl border border-border bg-white sm:rounded-[1.25rem] dark:bg-card">
            <Skeleton className="aspect-[5/3] w-full rounded-none sm:aspect-[4/3]" />
            <div className="flex flex-col gap-3 p-5">
              <Skeleton className="h-3 w-1/4" />
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-7 w-1/3" />
              <div className="flex gap-2">
                <Skeleton className="h-7 w-20 rounded-full" />
                <Skeleton className="h-7 w-16 rounded-full" />
              </div>
            </div>
          </div>
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
