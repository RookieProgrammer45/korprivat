'use client';

import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { RebookPanel } from '@/components/custom/dashboard/rebook-panel';
import { BookingMessagingEntry } from '@/components/custom/messaging/booking-messaging-entry';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { apiFetch } from '@/lib/api-client';
import {
  BookingConfirmResponse,
  BookingDisputeEscrowResponse,
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
      {upcoming.length > 0 ? (
        <HistorySection
          items={upcoming}
          section="upcoming"
          onChanged={() => setRetryNonce((n) => n + 1)}
        />
      ) : null}
      {past.length > 0 ? (
        <HistorySection items={past} section="past" onChanged={() => setRetryNonce((n) => n + 1)} />
      ) : null}
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
  onChanged,
}: {
  items: BookingHistoryItem[];
  section: 'upcoming' | 'past';
  onChanged: () => void;
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
            <BookingRow row={row} onChanged={onChanged} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function BookingRow({ row, onChanged }: { row: BookingHistoryItem; onChanged: () => void }) {
  const t = useTranslations('dashboard.student.history');
  const tEscrow = useTranslations('dashboard.student.escrow');
  const locale = useLocale();
  const [busy, setBusy] = useState(false);
  const [disputeOpen, setDisputeOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');

  const hoursLeft =
    row.autoReleaseAt != null
      ? Math.max(0, Math.ceil((new Date(row.autoReleaseAt).getTime() - Date.now()) / 3_600_000))
      : null;

  async function confirm() {
    setBusy(true);
    try {
      await apiFetch(`/api/bookings/${encodeURIComponent(row.id)}/confirm`, {
        method: 'POST',
        body: JSON.stringify({}),
        schema: BookingConfirmResponse,
      });
      toast.success(tEscrow('confirmSuccess'));
      onChanged();
    } catch {
      toast.error(tEscrow('actionError'));
    } finally {
      setBusy(false);
    }
  }

  async function submitDispute() {
    if (!reason.trim()) return;
    setBusy(true);
    try {
      await apiFetch(`/api/bookings/${encodeURIComponent(row.id)}/dispute-escrow`, {
        method: 'POST',
        body: JSON.stringify({ reason: reason.trim(), details: details.trim() || undefined }),
        schema: BookingDisputeEscrowResponse,
      });
      toast.success(tEscrow('disputeSuccess'));
      setDisputeOpen(false);
      onChanged();
    } catch {
      toast.error(tEscrow('actionError'));
    } finally {
      setBusy(false);
    }
  }

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
          {row.paymentStatus === 'awaiting_buyer_confirmation' && hoursLeft != null ? (
            <span className="text-caption text-muted-foreground">
              {tEscrow('autoConfirmIn', { hours: hoursLeft })}
            </span>
          ) : null}
        </div>
        <span className="text-small text-foreground">{formatDate(row.preferredAt, locale)}</span>
        <span className="font-display font-semibold tabular-nums text-foreground">
          {formatSek(row.hourlyRateSek, locale)}
        </span>
        <HistoryStatusBadge row={row} />
        <div className="flex flex-wrap justify-self-end gap-2 sm:justify-end">
          {row.paymentStatus === 'awaiting_buyer_confirmation' ? (
            <>
              <Button type="button" size="sm" disabled={busy} onClick={() => void confirm()}>
                {tEscrow('confirmCta')}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() => setDisputeOpen(true)}
              >
                {tEscrow('disputeCta')}
              </Button>
            </>
          ) : null}
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
      <Dialog open={disputeOpen} onOpenChange={setDisputeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{tEscrow('disputeTitle')}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={tEscrow('disputeReasonPlaceholder')}
              rows={3}
            />
            <Textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder={tEscrow('disputeDetailsPlaceholder')}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setDisputeOpen(false)}>
              {tEscrow('disputeCancel')}
            </Button>
            <Button
              type="button"
              disabled={busy || !reason.trim()}
              onClick={() => void submitDispute()}
            >
              {tEscrow('disputeSubmit')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function HistoryStatusBadge({ row }: { row: BookingHistoryItem }) {
  const tStatus = useTranslations('dashboard.student.paymentStatus');
  if (row.cancellationOutcome !== null) {
    return (
      <Badge variant="outline" className="border-border bg-muted text-muted-foreground">
        {tStatus('cancelled')}
      </Badge>
    );
  }
  if (row.disputeStatus === 'open' || row.paymentStatus === 'disputed') {
    return (
      <Badge variant="outline" className="border-border bg-muted text-muted-foreground">
        {tStatus('disputed')}
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
      return (
        <Badge
          variant="outline"
          className="border-brand-500/40 bg-brand-100 text-brand-700 dark:bg-brand-900 dark:text-brand-300"
        >
          {tStatus('paid')}
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
    case 'awaiting_buyer_confirmation':
      return (
        <Badge
          variant="outline"
          className="border-brand-500/40 bg-brand-100 text-brand-700 dark:bg-brand-900 dark:text-brand-300"
        >
          {tStatus('awaitingBuyerConfirmation')}
        </Badge>
      );
    case 'release_ready':
    case 'payout_pending':
      return (
        <Badge variant="outline" className="border-border bg-muted text-foreground">
          {tStatus('releaseReady')}
        </Badge>
      );
    case 'payout_failed':
      return (
        <Badge variant="outline" className="border-destructive/40 text-destructive">
          {tStatus('payoutFailed')}
        </Badge>
      );
    case 'released':
      return (
        <Badge
          variant="outline"
          className="border-brand-500/40 bg-brand-100 text-brand-700 dark:bg-brand-900 dark:text-brand-300"
        >
          {tStatus('released')}
        </Badge>
      );
    case 'disputed':
      return (
        <Badge variant="outline" className="border-border bg-muted text-muted-foreground">
          {tStatus('disputed')}
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
          {status === 'refunded' ? tStatus('refunded') : tStatus('cancelled')}
        </Badge>
      );
  }
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
    return `${amountSek} kr`;
  }
}
