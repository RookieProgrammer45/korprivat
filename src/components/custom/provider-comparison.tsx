// @polsia:user-owned — client-only comparison island for provider discovery.

'use client';

import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { InstructorFilteredItem } from '@/lib/contracts/instructors';

const MAX_COMPARISON_ITEMS = 3;

export { MAX_COMPARISON_ITEMS };

export function ProviderComparison({
  providers,
  onRemove,
  onClear,
}: {
  providers: InstructorFilteredItem[];
  onRemove: (id: string) => void;
  onClear: () => void;
}) {
  const t = useTranslations('instructorDirectory.comparison');
  const locale = useLocale();

  if (providers.length === 0) return null;

  return (
    <Card className="surface-card border-brand-500/40 bg-brand-100 shadow-md dark:bg-brand-900">
      <CardHeader className="gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div className="grid gap-1">
          <p className="text-eyebrow text-brand-700 dark:text-brand-300">{t('eyebrow')}</p>
          <CardTitle className="text-h3">{t('title')}</CardTitle>
          <p className="text-small text-muted-foreground">
            {t('count', { count: providers.length, max: MAX_COMPARISON_ITEMS })}
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={onClear}>
          {t('clear')}
        </Button>
      </CardHeader>
      <CardContent className="overflow-x-auto p-4 pt-0 sm:p-6 sm:pt-0">
        <div className="grid min-w-[42rem] gap-3 md:grid-cols-3">
          {providers.map((provider) => (
            <article
              key={provider.id}
              className="grid gap-3 rounded-lg border border-border bg-card p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="truncate font-display text-h4 text-foreground">{provider.name}</h3>
                  <p className="text-small text-muted-foreground">{provider.city}</p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="shrink-0"
                  onClick={() => onRemove(provider.id)}
                  aria-label={t('removeAria', { name: provider.name })}
                >
                  {t('remove')}
                </Button>
              </div>
              <dl className="grid gap-2 text-small">
                <Fact label={t('category')} value={provider.categories.join(', ')} />
                <Fact
                  label={t('language')}
                  value={provider.languages
                    .map((language) => t(`languages.${language}`))
                    .join(' · ')}
                />
                <Fact label={t('serviceArea')} value={provider.serviceArea} />
                <Fact
                  label={t('rate')}
                  value={t('rateValue', { amount: formatSek(provider.hourlyRateSek, locale) })}
                />
                <Fact label={t('fee')} value={t('feeValue')} />
                <Fact
                  label={t('availability')}
                  value={
                    provider.nextSlotAt
                      ? formatDate(provider.nextSlotAt, locale)
                      : t('noAvailability')
                  }
                />
                <Fact
                  label={t('bookingMode')}
                  value={t(
                    `bookingModes.${provider.bookingMode === 'request' ? 'request' : 'instant'}`,
                  )}
                />
                <Fact
                  label={t('cancellation')}
                  value={
                    provider.cancellationPolicyTier
                      ? t(`policies.${provider.cancellationPolicyTier}`)
                      : t('policyUnknown')
                  }
                />
                <Fact
                  label={t('reviews')}
                  value={
                    provider.reviewSummary.averageRating === null
                      ? t('noReviews')
                      : t('reviewsValue', {
                          average: formatNumber(provider.reviewSummary.averageRating, locale),
                          count: provider.reviewSummary.count,
                        })
                  }
                />
              </dl>
              <Button asChild variant="secondary" size="sm" className="w-full">
                <Link href={`/instructors/${encodeURIComponent(provider.id)}`}>
                  {t('viewProfile')}
                </Link>
              </Button>
            </article>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-0.5 border-b border-border/70 pb-2 last:border-b-0 last:pb-0">
      <dt className="text-caption uppercase tracking-[0.1em] text-muted-foreground">{label}</dt>
      <dd className="break-words font-medium text-foreground">{value}</dd>
    </div>
  );
}

function formatSek(amount: number, locale: string): string {
  return new Intl.NumberFormat(locale === 'sv' ? 'sv-SE' : 'en-GB', {
    style: 'currency',
    currency: 'SEK',
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatNumber(amount: number, locale: string): string {
  return new Intl.NumberFormat(locale === 'sv' ? 'sv-SE' : 'en-GB', {
    maximumFractionDigits: 1,
  }).format(amount);
}

function formatDate(iso: string, locale: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat(locale === 'sv' ? 'sv-SE' : 'en-GB', {
    dateStyle: 'medium',
    timeZone: 'Europe/Stockholm',
  }).format(date);
}
