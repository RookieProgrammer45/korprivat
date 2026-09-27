'use client';

import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { apiFetch } from '@/lib/api-client';
import { type ProviderBookingItem, ProviderBookingList } from '@/lib/contracts/provider-operations';

export function InstructorBookingHistory() {
  const t = useTranslations('dashboard.instructor.history');
  const locale = useLocale();
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [items, setItems] = useState<ProviderBookingItem[]>([]);

  const load = useCallback(() => {
    setState('loading');
    apiFetch('/api/bookings/instructor?state=completed', { schema: ProviderBookingList })
      .then((data) => {
        setItems(data.items);
        setState('ready');
      })
      .catch(() => setState('error'));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (state === 'loading') return <Skeleton className="h-56 w-full rounded-xl" />;
  if (state === 'error') {
    return (
      <Card className="border-destructive/30 bg-card">
        <CardContent className="flex items-center justify-between gap-4 p-6">
          <p className="text-small text-muted-foreground">{t('loadError')}</p>
          <Button type="button" variant="outline" size="sm" onClick={load}>
            {t('retry')}
          </Button>
        </CardContent>
      </Card>
    );
  }
  return (
    <section className="grid gap-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-eyebrow text-muted-foreground">{t('eyebrow')}</p>
          <h2 className="font-display text-h3 tracking-tight">{t('title')}</h2>
          <p className="mt-1 max-w-2xl text-small text-muted-foreground">{t('lead')}</p>
        </div>
        <p className="text-caption uppercase tracking-[0.12em] text-muted-foreground">
          {t('count', { count: items.length })}
        </p>
      </div>
      {items.length === 0 ? (
        <Card className="surface-panel border-border bg-card">
          <CardContent className="grid gap-2 p-6 text-small text-muted-foreground">
            <p className="font-medium text-foreground">{t('empty')}</p>
            <p>{t('emptyBody')}</p>
          </CardContent>
        </Card>
      ) : (
        <ul className="grid gap-3">
          {items.map((item) => (
            <li key={item.id}>
              <TransactionCard item={item} locale={locale} t={t} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function TransactionCard({
  item,
  locale,
  t,
}: {
  item: ProviderBookingItem;
  locale: string;
  t: ReturnType<typeof useTranslations<'dashboard.instructor.history'>>;
}) {
  return (
    <Card className="surface-card border-border bg-card">
      <CardContent className="grid gap-5 p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="grid gap-1">
            <p className="font-display text-h4 font-semibold">{item.counterpartyName}</p>
            <p className="text-small text-muted-foreground">
              {item.category} · {formatDate(item.scheduledAt, locale)}
            </p>
          </div>
          <Badge variant="outline">{statusLabel(item.paymentStatus, t)}</Badge>
        </div>

        <div className="grid gap-2 rounded-xl border border-border bg-muted/30 p-4">
          <MoneyRow
            label={t('grossPaid')}
            value={formatNullableSek(item.grossChargedSek, locale)}
          />
          <MoneyRow
            label={t('serviceFee')}
            value={formatNullableSek(item.serviceFeeSek, locale, true)}
          />
          <MoneyRow
            label={t('commission')}
            value={formatNullableSek(item.commissionSek, locale, true)}
          />
          <MoneyRow
            emphasized
            label={t('netPayout')}
            value={formatNullableSek(item.netPayoutSek, locale)}
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-small text-muted-foreground">
            {item.receiptStatus ? payoutLabel(item.receiptStatus, t) : t('payoutUnavailable')}
          </p>
          {item.receiptEmailStatus === 'failed' ? (
            <Badge variant="outline" className="border-destructive/40 text-destructive">
              <span className="sr-only">{t('receiptDeliveryFailed')}</span>
              {t('receiptDeliveryFailedShort')}
            </Badge>
          ) : null}
        </div>

        {item.receiptAvailable ? (
          <Button asChild size="sm" variant="outline" className="w-full sm:w-fit">
            <Link href={`/bookings/${encodeURIComponent(item.id)}/receipt`}>
              {t('receiptOpen')}
            </Link>
          </Button>
        ) : (
          <div className="grid gap-1 rounded-lg border border-dashed border-border p-3">
            <p className="text-small font-medium">{t('receiptUnavailable')}</p>
            <p className="text-caption text-muted-foreground">{t('receiptUnavailableBody')}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function MoneyRow({
  label,
  value,
  emphasized = false,
}: {
  label: string;
  value: string;
  emphasized?: boolean;
}) {
  return (
    <div
      className={`flex items-start justify-between gap-4 border-b border-border/70 pb-2 last:border-b-0 last:pb-0 ${emphasized ? 'pt-2 font-display text-h4 font-semibold' : 'text-small'}`}
    >
      <span className="min-w-0">{label}</span>
      <span className="shrink-0 text-right tabular-nums">{value}</span>
    </div>
  );
}

function formatNullableSek(amount: number | null, locale: string, negative = false) {
  if (amount === null) return '—';
  return `${negative ? '−' : ''}${formatSek(amount, locale)}`;
}

function formatDate(iso: string, locale: string) {
  return new Intl.DateTimeFormat(locale === 'sv' ? 'sv-SE' : 'en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Europe/Stockholm',
  }).format(new Date(iso));
}

function formatSek(amount: number, locale: string) {
  return new Intl.NumberFormat(locale === 'sv' ? 'sv-SE' : 'en-GB', {
    style: 'currency',
    currency: 'SEK',
    maximumFractionDigits: 0,
  }).format(amount);
}

function statusLabel(
  status: string,
  t: ReturnType<typeof useTranslations<'dashboard.instructor.history'>>,
) {
  const key =
    status === 'held_escrow'
      ? 'heldEscrow'
      : status === 'awaiting_approval'
        ? 'awaitingApproval'
        : status.startsWith('cancelled_')
          ? 'cancelled'
          : status;
  return t(`paymentStatus.${key}` as never);
}

function payoutLabel(
  status: string,
  t: ReturnType<typeof useTranslations<'dashboard.instructor.history'>>,
) {
  return t(`payoutStatus.${status}` as never);
}
