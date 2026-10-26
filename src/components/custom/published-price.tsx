// Prices taken from the school's own website. Always shown with their source
// and collection date so they never read as confirmed or bookable amounts.

'use client';

import { useLocale, useTranslations } from 'next-intl';
import type { InstructorFilteredItem } from '@/lib/contracts/instructors';

type Prices = NonNullable<InstructorFilteredItem['publishedPrices']>;

// Card variant: the lesson price only.
export function PublishedLessonPrice({ prices }: { prices: Prices }) {
  const t = useTranslations('publishedPrice');
  const locale = useLocale();
  if (!prices.lesson) return null;
  return (
    <div className="grid min-w-0 gap-1">
      <p className="dlu-school-price">
        {t('amount', { amount: formatAmount(prices.lesson.priceSek, locale) })}
        {prices.lesson.minutes ? (
          <span className="ml-2 font-sans text-sm tracking-normal text-muted-foreground">
            {t('minutes', { minutes: prices.lesson.minutes })}
          </span>
        ) : null}
      </p>
      <SourceNote prices={prices} />
    </div>
  );
}

// Card line: the cheapest published package, so a package-price sort reads.
export function PublishedPackageFrom({ prices }: { prices: Prices }) {
  const t = useTranslations('publishedPrice');
  const locale = useLocale();
  if (prices.packages.length === 0) return null;
  const cheapest = Math.min(...prices.packages.map((pack) => pack.priceSek));
  return (
    <p className="text-small text-foreground">
      {t('packageFrom', { amount: formatAmount(cheapest, locale) })}
      {prices.lesson ? null : (
        <span className="ml-1.5 text-caption text-muted-foreground">
          {t('source', { date: formatDate(prices.collectedAt, locale) })}
        </span>
      )}
    </p>
  );
}

// Profile and comparison variant: lesson, Risk 1, Risk 2 and packages.
export function PublishedPriceList({
  prices,
  showSourceLink = false,
}: {
  prices: Prices;
  showSourceLink?: boolean;
}) {
  const t = useTranslations('publishedPrice');
  const locale = useLocale();
  const amount = (value: number) => t('amount', { amount: formatAmount(value, locale) });
  const rows: Array<{ key: string; label: string; detail?: string; value: string }> = [];
  if (prices.lesson) {
    rows.push({
      key: 'lesson',
      label: t('lesson'),
      detail: prices.lesson.minutes ? t('minutes', { minutes: prices.lesson.minutes }) : undefined,
      value: amount(prices.lesson.priceSek),
    });
  }
  if (prices.risk1Sek)
    rows.push({ key: 'risk1', label: t('risk1'), value: amount(prices.risk1Sek) });
  if (prices.risk2Sek)
    rows.push({ key: 'risk2', label: t('risk2'), value: amount(prices.risk2Sek) });
  prices.packages.forEach((pack, index) => {
    rows.push({
      key: `package-${index}`,
      label: pack.name,
      detail:
        pack.kind === 'intensive'
          ? /intensiv/i.test(pack.name)
            ? undefined
            : t('intensive')
          : pack.lessons
            ? t('lessons', { count: pack.lessons })
            : t('package'),
      value: amount(pack.priceSek),
    });
  });
  if (rows.length === 0) return null;

  return (
    <div className="grid min-w-0 gap-2">
      <dl className="grid min-w-0 gap-1.5 text-small">
        {rows.map((row) => (
          <div key={row.key} className="flex min-w-0 items-baseline justify-between gap-3">
            <dt className="min-w-0 break-words text-foreground">
              {row.label}
              {row.detail ? (
                <span className="ml-1.5 text-muted-foreground">{row.detail}</span>
              ) : null}
            </dt>
            <dd className="shrink-0 font-medium tabular-nums text-foreground">{row.value}</dd>
          </div>
        ))}
      </dl>
      <SourceNote prices={prices} showSourceLink={showSourceLink} />
    </div>
  );
}

function SourceNote({
  prices,
  showSourceLink = false,
}: {
  prices: Prices;
  showSourceLink?: boolean;
}) {
  const t = useTranslations('publishedPrice');
  const locale = useLocale();
  return (
    <p className="text-caption text-muted-foreground">
      {t('source', { date: formatDate(prices.collectedAt, locale) })}
      {showSourceLink && prices.sourceUrl ? (
        <>
          {' '}
          <a
            href={prices.sourceUrl}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="underline underline-offset-2 hover:text-foreground"
          >
            {t('sourceLink')}
          </a>
        </>
      ) : null}
    </p>
  );
}

function formatAmount(amount: number, locale: string): string {
  return new Intl.NumberFormat(locale === 'sv' ? 'sv-SE' : 'en-GB').format(amount);
}

function formatDate(isoDate: string, locale: string): string {
  return new Intl.DateTimeFormat(locale === 'sv' ? 'sv-SE' : 'en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Europe/Stockholm',
  }).format(new Date(`${isoDate}T12:00:00Z`));
}
