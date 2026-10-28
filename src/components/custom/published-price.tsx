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
        {money(t, prices.lesson.priceSek, prices.currency, locale)}
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
      {prices.currency && prices.currency !== 'SEK'
        ? t('packageFromCurrency', {
            currency: prices.currency,
            amount: formatAmount(cheapest, locale),
          })
        : t('packageFrom', { amount: formatAmount(cheapest, locale) })}
      {prices.lesson ? null : (
        <span className="ml-1.5 text-caption text-muted-foreground">
          {t('source', { date: formatDate(prices.collectedAt, locale) })}
        </span>
      )}
    </p>
  );
}

// Profile and comparison variant: lesson, Risk 1, Risk 2, packages and heavy vehicles.
export function PublishedPriceList({
  prices,
  showSourceLink = false,
  heavyOnly = false,
}: {
  prices: Prices;
  showSourceLink?: boolean;
  heavyOnly?: boolean;
}) {
  const t = useTranslations('publishedPrice');
  const locale = useLocale();
  const amount = (value: number) => money(t, value, prices.currency, locale);
  const rows: Row[] = [];
  if (!heavyOnly && prices.lesson) {
    rows.push({
      key: 'lesson',
      label: t('lesson'),
      detail: prices.lesson.minutes ? t('minutes', { minutes: prices.lesson.minutes }) : undefined,
      value: amount(prices.lesson.priceSek),
    });
  }
  if (!heavyOnly && prices.risk1Sek)
    rows.push({ key: 'risk1', label: t('risk1'), value: amount(prices.risk1Sek) });
  if (!heavyOnly && prices.risk2Sek)
    rows.push({ key: 'risk2', label: t('risk2'), value: amount(prices.risk2Sek) });
  if (!heavyOnly) {
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
  }
  const heavy = prices.heavy;
  if (rows.length === 0 && !heavy) return null;

  return (
    <div className="grid min-w-0 gap-4">
      {rows.length > 0 ? (
        <div className="grid min-w-0 gap-2">
          <PriceRows rows={rows} />
          <SourceNote prices={prices} showSourceLink={showSourceLink} />
        </div>
      ) : null}
      {heavy ? (
        <HeavyPrices heavy={heavy} currency={prices.currency} showSourceLink={showSourceLink} />
      ) : null}
    </div>
  );
}

type Row = { key: string; label: string; detail?: string; value: string };

function PriceRows({ rows }: { rows: Row[] }) {
  return (
    <dl className="grid min-w-0 gap-1.5 text-small">
      {rows.map((row) => (
        <div key={row.key} className="flex min-w-0 items-baseline justify-between gap-3">
          <dt className="min-w-0 break-words text-foreground">
            {row.label}
            {row.detail ? <span className="ml-1.5 text-muted-foreground">{row.detail}</span> : null}
          </dt>
          <dd className="shrink-0 font-medium tabular-nums text-foreground">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function HeavyPrices({
  heavy,
  currency,
  showSourceLink,
}: {
  heavy: NonNullable<Prices['heavy']>;
  currency: Prices['currency'];
  showSourceLink: boolean;
}) {
  const t = useTranslations('publishedPrice');
  const locale = useLocale();
  const offered = [...heavy.categories, ...(heavy.ykb ? ['YKB'] : [])].join(', ');
  const rows: Row[] = heavy.prices.map((price, index) => ({
    key: `heavy-${index}`,
    label: price.name,
    detail: [
      new RegExp(`(^|[^A-Za-z0-9])${price.category}([^A-Za-z0-9]|$)`).test(price.name)
        ? null
        : price.category,
      price.minutes ? t('minutes', { minutes: price.minutes }) : null,
      price.hours ? t('hours', { hours: price.hours }) : null,
    ]
      .filter(Boolean)
      .join(' · '),
    value: money(t, price.priceSek, currency, locale),
  }));
  return (
    <div className="grid min-w-0 gap-2">
      <div className="grid min-w-0 gap-0.5">
        <p className="text-small font-medium text-foreground">{t('heavyHeading')}</p>
        <p className="text-caption text-muted-foreground">{t('heavyOffered', { list: offered })}</p>
      </div>
      {rows.length > 0 ? <PriceRows rows={rows} /> : null}
      <p className="text-caption text-muted-foreground">
        {t('source', { date: formatDate(heavy.collectedAt, locale) })}
        {showSourceLink && heavy.sourceUrl ? (
          <>
            {' '}
            <a
              href={heavy.sourceUrl}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="underline underline-offset-2 hover:text-foreground"
            >
              {t('sourceLink')}
            </a>
          </>
        ) : null}
      </p>
    </div>
  );
}

// Card line: heavy-vehicle training the school's website advertises.
export function PublishedHeavyOffer({ prices }: { prices: Prices }) {
  const t = useTranslations('publishedPrice');
  const locale = useLocale();
  const heavy = prices.heavy;
  if (!heavy) return null;
  const groups = [
    heavy.categories.some((code) => code.startsWith('C')) ? t('heavyTruck') : null,
    heavy.categories.some((code) => code.startsWith('D')) ? t('heavyBus') : null,
    heavy.ykb ? 'YKB' : null,
  ].filter(Boolean);
  if (groups.length === 0) return null;
  const cheapest =
    heavy.prices.length > 0 ? Math.min(...heavy.prices.map((p) => p.priceSek)) : null;
  return (
    <p className="text-small text-foreground">
      {groups.join(' · ')}
      {cheapest != null ? (
        <span className="ml-1.5 text-muted-foreground">
          {prices.currency && prices.currency !== 'SEK'
            ? t('heavyFromCurrency', {
                currency: prices.currency,
                amount: formatAmount(cheapest, locale),
              })
            : t('heavyFrom', { amount: formatAmount(cheapest, locale) })}
        </span>
      ) : null}
    </p>
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

function money(
  t: ReturnType<typeof useTranslations<'publishedPrice'>>,
  amount: number,
  currency: string | undefined,
  locale: string,
): string {
  const formatted = formatAmount(amount, locale);
  if (currency && currency !== 'SEK') {
    return t('amountCurrency', { currency, amount: formatted });
  }
  return t('amount', { amount: formatted });
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
