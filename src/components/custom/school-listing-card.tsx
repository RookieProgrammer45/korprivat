'use client';

import Image from 'next/image';
import { useLocale, useTranslations } from 'next-intl';
import { LocaleLink as Link } from '@/components/locale-link';
import { useState } from 'react';
import { PublishedHeavyOffer, PublishedLessonPrice } from '@/components/custom/published-price';
import { SCHOOL_LISTING_GRID_CLASS } from '@/components/custom/school-listing-grid';
import { SchoolMarkFallback } from '@/components/custom/school-mark-fallback';
import type { InstructorFilteredItem } from '@/lib/contracts/instructors';
import { type SchoolHeavyAdvertised, schoolPortraitUrl } from '@/lib/discovery/school-portrait';
import { schoolPath } from '@/lib/seo/school-slugs';

export { SCHOOL_LISTING_GRID_CLASS };

export function SchoolListingCard({
  row,
  heavyScope = false,
}: {
  row: InstructorFilteredItem;
  heavyScope?: boolean;
}) {
  const tr = useTranslations('instructorPreview');
  const locale = useLocale();
  const rating = listingRating(row);
  const categoryCodes = heavyScope ? heavyCategoryLabels(row) : row.categories;

  return (
    <Link
      href={schoolPath(row)}
      className="group block h-full min-w-0 rounded-[1.25rem] outline-none focus-visible:ring-2 focus-visible:ring-foreground/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      data-provider-type={row.providerType}
    >
      <article className="flex h-full min-w-0 flex-col overflow-hidden rounded-xl border border-border bg-white shadow-sm transition-[transform,box-shadow,border-color] duration-200 group-hover:-translate-y-0.5 group-hover:border-foreground/20 group-hover:shadow-md motion-reduce:transition-none motion-reduce:group-hover:translate-y-0 sm:rounded-[1.25rem] dark:bg-card">
        <SchoolMark
          name={row.name}
          photoUrl={row.photoUrl}
          categories={row.categories}
          heavy={row.publishedPrices?.heavy ?? null}
          heavyScope={heavyScope}
          alt={tr('portraitAlt', { name: row.name })}
          size="cover"
        />
        <div className="flex flex-1 flex-col gap-2 p-3 sm:gap-2.5 sm:p-4">
          <div className="min-w-0">
            <p className="flex min-w-0 items-start justify-between gap-2 text-[11px] leading-snug text-muted-foreground sm:text-small">
              <span className="min-w-0 truncate">{row.city}</span>
              {rating ? (
                <span className="shrink-0 font-medium text-foreground">
                  <span aria-hidden>★ {formatRating(rating.average, locale)}</span>
                  <span className="sr-only">
                    {tr('ratingChipAria', {
                      average: formatRating(rating.average, locale),
                      count: rating.count,
                    })}
                  </span>
                </span>
              ) : null}
            </p>
            <h3 className="line-clamp-2 break-words font-display text-sm font-normal leading-snug tracking-tight text-foreground sm:text-h4 sm:leading-normal">
              {row.name}
            </h3>
          </div>
          {heavyScope ? (
            row.publishedPrices ? (
              <PublishedHeavyOffer prices={row.publishedPrices} />
            ) : null
          ) : row.publishedPrices?.lesson ? (
            <PublishedLessonPrice prices={row.publishedPrices} />
          ) : null}
          {categoryCodes.length > 0 ? (
            <div className="mt-auto flex flex-wrap gap-1.5">
              {categoryCodes.slice(0, 3).map((category) => (
                <span key={category} className="dlu-chip">
                  {heavyScope ? category : categoryChipLabel(tr(`category.${category}`), category)}
                </span>
              ))}
            </div>
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
        iconLayout={size === 'cover' ? 'cover' : 'avatar'}
        className={
          size === 'cover'
            ? 'dlu-school-photo dlu-school-photo--compact box-border flex min-h-0 min-w-0 items-center justify-center p-6 font-display text-lg font-normal text-foreground sm:p-8 sm:text-4xl'
            : 'box-border flex size-12 shrink-0 items-center justify-center rounded-full border border-border bg-[#ece9e2] p-1.5 font-display text-sm font-normal text-foreground dark:bg-[#1a1a18]'
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
        sizes="(min-width: 1536px) 18vw, (min-width: 1280px) 22vw, (min-width: 1024px) 30vw, 50vw"
        onError={() => setFailed(true)}
        className="object-contain p-8"
      />
    </span>
  );
}

export function categoryChipLabel(label: string, code: string): string {
  return label === code ? code : `${label} · ${code}`;
}

function listingRating(row: InstructorFilteredItem): { average: number; count: number } | null {
  if (row.googleRating != null && (row.googleReviewCount ?? 0) > 0) {
    return { average: row.googleRating, count: row.googleReviewCount ?? 0 };
  }
  if (row.reviewSummary.averageRating != null && row.reviewSummary.count > 0) {
    return { average: row.reviewSummary.averageRating, count: row.reviewSummary.count };
  }
  return null;
}

function formatRating(average: number, locale: string): string {
  return new Intl.NumberFormat(locale === 'sv' ? 'sv-SE' : 'en-GB', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(average);
}

function heavyCategoryLabels(row: InstructorFilteredItem): string[] {
  const heavy = row.publishedPrices?.heavy;
  if (!heavy) return [];
  return [...heavy.categories, ...(heavy.ykb ? ['YKB'] : [])];
}
