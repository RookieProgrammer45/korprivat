//
// This island is shared by the home page and the provider-facing preview. It
// uses the same public list contract as the directory and links every card to
// the learner-facing profile, with no operational or social-proof metrics.

'use client';

import Image from 'next/image';
import Link from 'next/link';
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

const MAX_PREVIEW_ROWS = 3;

type Status = 'loading' | 'ready' | 'empty' | 'error';

export function InstructorPreview({
  limit = MAX_PREVIEW_ROWS,
  pageIntro = false,
  showContact = true,
}: {
  limit?: number;
  pageIntro?: boolean;
  showContact?: boolean;
}) {
  const tr = useTranslations('instructorPreview');
  const [status, setStatus] = useState<Status>('loading');
  const [rows, setRows] = useState<InstructorFilteredItem[]>([]);

  useEffect(() => {
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
  const price = formatSek(row.hourlyRateSek, locale, tr('rateSuffixShort'));
  return (
    <Link
      href={`/instructors/${row.id}`}
      className="group block h-full min-w-0 rounded-[1.25rem] outline-none focus-visible:ring-2 focus-visible:ring-foreground/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      data-provider-type={row.providerType}
    >
      <article className="flex h-full min-w-0 flex-col overflow-hidden rounded-[1.25rem] border border-border bg-white shadow-sm transition-[transform,box-shadow,border-color] duration-200 group-hover:-translate-y-0.5 group-hover:border-foreground/20 group-hover:shadow-md motion-reduce:transition-none motion-reduce:group-hover:translate-y-0 dark:bg-card">
        <SchoolMark
          name={row.name}
          photoUrl={row.photoUrl}
          alt={tr('portraitAlt', { name: row.name })}
          size="cover"
        />
        <div className="flex flex-1 flex-col gap-3 p-5">
          <div className="min-w-0">
            <p className="text-small text-muted-foreground">
              {row.phone ? `${row.city} · ${row.phone.display}` : row.city}
            </p>
            <h3 className="break-words font-display text-h4 font-normal tracking-tight text-foreground">
              {row.name}
            </h3>
          </div>
          {row.publishedPrices?.lesson ? (
            <PublishedLessonPrice prices={row.publishedPrices} />
          ) : price ? (
            <p className="dlu-school-price">{price}</p>
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
  alt,
  size,
}: {
  name: string;
  photoUrl: string;
  alt: string;
  size: 'cover' | 'avatar';
}) {
  const [failed, setFailed] = useState(false);
  const photograph = isPhotograph(photoUrl) && !failed;
  if (!photograph) {
    return (
      <span
        aria-hidden
        className={
          size === 'cover'
            ? 'dlu-school-photo flex items-center justify-center font-display text-4xl font-normal text-foreground'
            : 'flex size-12 shrink-0 items-center justify-center rounded-full border border-border bg-[#ece9e2] font-display text-sm font-normal text-foreground dark:bg-[#1a1a18]'
        }
      >
        {initials(name)}
      </span>
    );
  }
  if (size === 'avatar') {
    return (
      <Image
        src={photoUrl}
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
        src={photoUrl}
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

function isPhotograph(url: string): boolean {
  const path = url.split('?')[0]?.trim().toLowerCase() ?? '';
  if (!path) return false;
  return !path.endsWith('.svg');
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean).slice(0, 2);
  return parts
    .map((part) => part[0] ?? '')
    .join('')
    .toUpperCase();
}

function PreviewSkeleton({ limit }: { limit: number }) {
  const ids = Array.from(
    { length: Math.min(Math.max(1, limit), MAX_PREVIEW_ROWS) },
    (_, index) => `preview-skeleton-${index + 1}`,
  );
  return (
    <ul className="grid min-w-0 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {ids.map((skeletonId) => (
        <li key={skeletonId} aria-hidden>
          <div className="flex h-full min-w-0 flex-col overflow-hidden rounded-[1.25rem] border border-border bg-white dark:bg-card">
            <Skeleton className="aspect-[4/3] w-full rounded-none" />
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

function formatSek(amount: number, locale: 'en' | 'sv', suffix: string): string | null {
  if (!amount) return null;
  return `${new Intl.NumberFormat(locale === 'sv' ? 'sv-SE' : 'en-GB').format(amount)} ${suffix}`;
}
