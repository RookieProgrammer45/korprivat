//
// Read-only list of every booking the signed-in learner owns.
// Fetches `/api/bookings/me/history` (apiFetch + zod contract — the response
// is parsed through BookingHistoryList so the typed wire stays in sync with
// the server route). One fetch on mount + a `Retry` button that bumps a
// nonce to refire.
//
// Splits the items into Upcoming / Past on the client by `preferredAt >
// Date.now()` AND `cancellationOutcome == null` — that's the clearest rule
// without a calendar on the server. Both branches are skipped when empty so
// a fresh learner doesn't see a placeholder Past section. Status badge lives
// on a small switch that prefers cancellation/dispute signals over the
// payment status. Each row links to `/bookings/[id]` (read-only).

'use client';

import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { RebookPanel } from '@/components/custom/dashboard/rebook-panel';
import { BookingMessagingEntry } from '@/components/custom/messaging/booking-messaging-entry';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { apiFetch } from '@/lib/api-client';
import {
  type BookingHistoryItem,
  BookingHistoryList,
  type BookingPaymentStatus,
} from '@/lib/contracts/bookings';

type State =
  | { kind: 'loading' }
  | { kind: 'ready'; upcoming: BookingHistoryItem[]; past: BookingHistoryItem[] }
  | { kind: 'error' };

export function StudentBookingHistory() {
  const t = useTranslations('dashboard.student.history');
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [retryNonce, setRetryNonce] = useState(0);

  useEffect(() => {
    let active = true;
    setState({ kind: 'loading' });
    void retryNonce;
    apiFetch('/api/bookings/me/history', { schema: BookingHistoryList })
      .then((data) => {
        if (!active) return;
        const now = Date.now();
        const upcoming: BookingHistoryItem[] = [];
        const past: BookingHistoryItem[] = [];
        for (const item of data.items) {
          const ts = new Date(item.preferredAt).getTime();
          const isCancelled = item.cancellationOutcome !== null;
          // cancellationOutcome wins over a future timestamp — a cancelled
          // future lesson is "Past" so the learner doesn't double-book the
          // slot in their head.
          if (isCancelled || (Number.isFinite(ts) && ts <= now)) {
            past.push(item);
          } else {
            upcoming.push(item);
          }
        }
        setState({ kind: 'ready', upcoming, past });
      })
      .catch(() => {
        if (!active) return;
        setState({ kind: 'error' });
      });
    return () => {
      active = false;
    };
  }, [retryNonce]);

  if (state.kind === 'loading') {
    return (
      <div className="grid gap-4">
        <Skeleton className="h-32 w-full rounded-lg" />
        <Skeleton className="h-32 w-full rounded-lg" />
      </div>
    );
  }
  if (state.kind === 'error') {
    return (
      <Card className="border-brand-500/40 bg-brand-100 dark:bg-brand-900">
        <CardContent className="flex flex-col gap-3 p-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-small text-brand-700 dark:text-brand-300">{t('loadError')}</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setRetryNonce((n) => n + 1)}
            className="border-brand-500/40"
          >
            {t('retry')}
          </Button>
        </CardContent>
      </Card>
    );
  }

  const { upcoming, past } = state;

  if (upcoming.length === 0 && past.length === 0) {
    return (
      <Card className="surface-panel border-border bg-card">
        <CardContent className="flex flex-col gap-3 p-8">
          <p className="text-body font-medium text-foreground">{t('emptyTitle')}</p>
          <p className="text-small text-muted-foreground">{t('emptyBody')}</p>
          <div className="mt-2">
            <Button asChild size="sm" variant="secondary">
              <Link href="/instructors">{t('emptyCta')}</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-8">
      <RebookPanel />
      {upcoming.length > 0 ? <HistorySection items={upcoming} section="upcoming" /> : null}
      {past.length > 0 ? <HistorySection items={past} section="past" /> : null}
      <p className="text-caption text-muted-foreground">{t('priceApproxNote')}</p>
      <div>
        <Button asChild variant="ghost" size="sm">
          <Link href="/dashboard/student">{t('backToDashboard')}</Link>
        </Button>
      </div>
    </div>
  );
}

function HistorySection({
  items,
  section,
}: {
  items: BookingHistoryItem[];
  section: 'upcoming' | 'past';
}) {
  const t = useTranslations('dashboard.student.history');
  return (
    <section className="grid gap-3">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-h3 leading-tight tracking-tight text-foreground">
          {section === 'upcoming' ? t('sectionUpcoming') : t('sectionPast')}
        </h2>
        <p className="text-caption font-medium uppercase tracking-[0.12em] text-muted-foreground">
          {t('count', { count: items.length })}
        </p>
      </div>
      <ul className="grid gap-3">
        {items.map((row) => (
          <li key={row.id}>
            <BookingRow row={row} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function BookingRow({ row }: { row: BookingHistoryItem }) {
  const t = useTranslations('dashboard.student.history');
  const locale = useLocale();
  return (
    <Card className="surface-card border-border bg-card transition-colors duration-200 hover:border-brand-500/40 hover:shadow-md">
      <CardContent className="grid gap-3 p-5 sm:grid-cols-[2fr_1fr_1fr_auto_auto] sm:items-center">
        <div className="flex flex-col gap-0.5">
          <span className="font-display text-base font-semibold text-foreground">
            {row.instructorName}
          </span>
          <span className="text-small text-muted-foreground">
            {row.city ? `${row.city} · ${row.category}` : row.category}
          </span>
        </div>
        <span className="text-small text-foreground">{formatDate(row.preferredAt, locale)}</span>
        <span className="font-display font-semibold tabular-nums text-foreground">
          {formatSek(row.hourlyRateSek, locale)}
        </span>
        <HistoryStatusBadge row={row} />
        <div className="flex flex-wrap justify-self-end sm:justify-end">
          <Button asChild variant="ghost" size="sm">
            <Link href={`/bookings/${encodeURIComponent(row.id)}`}>{t('statusLabel')}</Link>
          </Button>
          {row.receiptAvailable ? (
            <Button asChild variant="outline" size="sm">
              <Link href={`/bookings/${encodeURIComponent(row.id)}/receipt`}>
                {t('receiptLink')}
              </Link>
            </Button>
          ) : null}
          {row.receiptEmailStatus === 'failed' ? (
            <Badge variant="outline" className="border-destructive/40 text-destructive">
              <span className="sr-only">{t('receiptDeliveryFailed')}</span>
              {t('receiptDeliveryFailedShort')}
            </Badge>
          ) : null}
          {row.completedAt &&
          row.paymentStatus === 'released' &&
          row.cancellationOutcome === null &&
          row.disputeStatus !== 'open' ? (
            <Button asChild variant="secondary" size="sm">
              <Link
                href={`/instructors/${encodeURIComponent(row.instructorId)}?review=${encodeURIComponent(row.id)}`}
              >
                {t('reviewCta')}
              </Link>
            </Button>
          ) : null}
          <BookingMessagingEntry bookingId={row.id} />
        </div>
      </CardContent>
    </Card>
  );
}

function HistoryStatusBadge({ row }: { row: BookingHistoryItem }) {
  const t = useTranslations('dashboard.student.history');
  // cancellation / dispute win over the payment status — they are terminal
  // and the most important signal to a learner scanning the list.
  if (row.cancellationOutcome !== null) {
    return (
      <Badge variant="outline" className="border-border bg-muted text-muted-foreground">
        {t('statusCancelled')}
      </Badge>
    );
  }
  if (row.disputeStatus === 'open') {
    return (
      <Badge
        variant="outline"
        className="border-brand-500/40 bg-brand-100 text-brand-700 dark:bg-brand-900 dark:text-brand-300"
      >
        {t('statusDisputeOpen')}
      </Badge>
    );
  }
  return <PaymentBadge status={row.paymentStatus} />;
}

function PaymentBadge({ status }: { status: BookingPaymentStatus }) {
  const tStatus = useTranslations('dashboard.student.paymentStatus');
  switch (status) {
    case 'unpaid':
      return (
        <Badge
          variant="outline"
          className="border-brand-500/40 bg-brand-100 text-brand-700 dark:bg-brand-900 dark:text-brand-300"
        >
          {tStatus('unpaid')}
        </Badge>
      );
    case 'pending':
      return (
        <Badge variant="outline" className="border-border bg-muted text-foreground">
          {tStatus('pending')}
        </Badge>
      );
    case 'paid':
    case 'released':
      return (
        <Badge
          variant="outline"
          className="border-brand-500/40 bg-brand-100 text-brand-700 dark:bg-brand-900 dark:text-brand-300"
        >
          {status === 'paid' ? tStatus('paid') : tStatus('released')}
        </Badge>
      );
    case 'held_escrow':
      return (
        <Badge
          variant="outline"
          className="border-brand-500/40 bg-brand-100 text-brand-700 dark:bg-brand-900 dark:text-brand-300"
        >
          {tStatus('heldEscrow')}
        </Badge>
      );
    case 'awaiting_approval':
      return (
        <Badge
          variant="outline"
          className="border-brand-500/40 bg-brand-100 text-brand-700 dark:bg-brand-900 dark:text-brand-300"
        >
          {tStatus('awaitingApproval')}
        </Badge>
      );
    case 'declined':
      return (
        <Badge variant="outline" className="border-border bg-muted text-muted-foreground">
          {tStatus('declined')}
        </Badge>
      );
    case 'refunded':
    case 'cancelled_early':
    case 'cancelled_full_refund':
    case 'cancelled_partial':
    case 'cancelled_late':
      return (
        <Badge variant="outline" className="border-border bg-muted text-muted-foreground">
          {refundOrCancelledLabel(status, tStatus)}
        </Badge>
      );
  }
}

function refundOrCancelledLabel(
  status:
    | 'refunded'
    | 'cancelled_early'
    | 'cancelled_full_refund'
    | 'cancelled_partial'
    | 'cancelled_late',
  tStatus: ReturnType<typeof useTranslations<'dashboard.student.paymentStatus'>>,
): string {
  if (status === 'refunded') return tStatus('refunded');
  return tStatus('cancelled');
}

function formatDate(iso: string, locale: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat(locale === 'sv' ? 'sv-SE' : 'en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Europe/Stockholm',
  }).format(d);
}

function formatSek(amountSek: number, locale: string): string {
  try {
    return new Intl.NumberFormat(locale === 'sv' ? 'sv-SE' : 'en-GB', {
      style: 'currency',
      currency: 'SEK',
      useGrouping: true,
      maximumFractionDigits: 0,
    }).format(amountSek);
  } catch {
    return `${amountSek} SEK`;
  }
}
