
'use client';

import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { type ReactNode, useEffect, useState } from 'react';
import { BookingPriceSummary } from '@/components/custom/booking-price-summary';
import { BookingMessagingEntry } from '@/components/custom/messaging/booking-messaging-entry';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { apiFetch } from '@/lib/api-client';
import {
  BookingPaymentLinkResponse,
  BookingPaymentPollResponse,
  BookingRead,
} from '@/lib/contracts/bookings';

const POLL_INTERVAL_MS = 1500;
const POLL_MAX_ATTEMPTS = 10;

type Status =
  | { kind: 'loading' }
  | { kind: 'access-error' }
  | {
      kind: 'ready';
      booking: BookingRead;
      paymentLoading: boolean;
      error: string | null;
    };

export function BookingPaymentLink({ bookingId, token }: { bookingId: string; token?: string }) {
  const t = useTranslations('bookingConfirmPayment');
  const locale = useLocale();
  const [status, setStatus] = useState<Status>({ kind: 'loading' });
  const [paymentPollError, setPaymentPollError] = useState(false);
  const [_paymentPollRetryNonce, setPaymentPollRetryNonce] = useState(0);

  useEffect(() => {
    let active = true;
    apiFetch(`/api/bookings/${encodeURIComponent(bookingId)}`, {
      schema: BookingRead,
      headers: accessHeaders(token),
    })
      .then((booking) => {
        if (active) {
          setPaymentPollError(false);
          setStatus({ kind: 'ready', booking, paymentLoading: false, error: null });
        }
      })
      .catch(() => {
        if (active) setStatus({ kind: 'access-error' });
      });
    return () => {
      active = false;
    };
  }, [bookingId, token]);

  const startPayment = async () => {
    if (status.kind !== 'ready') return;
    const id = status.booking.id;
    setStatus((current) =>
      current.kind === 'ready' ? { ...current, paymentLoading: true, error: null } : current,
    );
    setPaymentPollError(false);
    try {
      const result = await apiFetch(`/api/bookings/${encodeURIComponent(id)}/payment-link`, {
        method: 'POST',
        body: JSON.stringify(token ? { token } : {}),
        headers: accessHeaders(token),
        schema: BookingPaymentLinkResponse,
      });
      if (result.url) {
        window.location.assign(result.url);
        return;
      }
      const fresh = await readBooking(id, token);
      setPaymentPollError(false);
      setStatus({ kind: 'ready', booking: fresh, paymentLoading: false, error: null });
    } catch (err: unknown) {
      const body = err instanceof Error ? err.cause : null;
      const paymentError =
        body &&
        typeof body === 'object' &&
        'errors' in body &&
        (body as { errors?: { payments?: string } }).errors?.payments;
      const message = paymentError === 'not_onboarded' ? t('providerNotReady') : t('paymentError');
      setStatus((current) =>
        current.kind === 'ready' ? { ...current, paymentLoading: false, error: message } : current,
      );
    }
  };

  const pendingBookingId =
    status.kind === 'ready' && status.booking.paymentStatus === 'pending'
      ? status.booking.id
      : null;

  useEffect(() => {
    if (!pendingBookingId) return;
    let active = true;
    let attempt = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const tick = async () => {
      if (!active) return;
      attempt += 1;
      try {
        const result = await apiFetch(
          `/api/bookings/${encodeURIComponent(pendingBookingId)}/payment-poll`,
          { schema: BookingPaymentPollResponse, headers: accessHeaders(token) },
        );
        if (!active) return;
        if (result.verified && result.paymentStatus !== 'pending') {
          const fresh = await readBooking(pendingBookingId, token);
          if (active) {
            setPaymentPollError(false);
            setStatus({ kind: 'ready', booking: fresh, paymentLoading: false, error: null });
          }
          return;
        }
      } catch {
        // The next poll handles transient checkout/API failures.
      }
      if (active && attempt < POLL_MAX_ATTEMPTS) {
        timer = setTimeout(tick, POLL_INTERVAL_MS);
      } else if (active) {
        setPaymentPollError(true);
      }
    };

    timer = setTimeout(tick, POLL_INTERVAL_MS);
    return () => {
      active = false;
      if (timer) clearTimeout(timer);
    };
  }, [pendingBookingId, token]);

  if (status.kind === 'loading') {
    return (
      <Card className="surface-panel border-border bg-card">
        <CardContent className="flex flex-col gap-3 p-6">
          <Skeleton className="h-6 w-1/3" />
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-9 w-1/2" />
        </CardContent>
      </Card>
    );
  }

  if (status.kind === 'access-error') {
    return (
      <Card className="border-destructive/40 bg-destructive/5">
        <CardContent className="flex flex-col gap-3 p-6">
          <p className="font-display text-h3 tracking-tight text-foreground">{t('accessTitle')}</p>
          <p className="text-small text-muted-foreground">{t('accessBody')}</p>
          <Button asChild variant="outline" size="sm" className="w-fit">
            <Link href="/instructors">{t('browseCta')}</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const { booking } = status;
  const snapshot =
    booking.priceAmountSek !== null &&
    booking.serviceFeeSek !== null &&
    booking.grossChargedSek !== null
      ? {
          priceAmountSek: booking.priceAmountSek,
          serviceFeeSek: booking.serviceFeeSek,
          grossChargedSek: booking.grossChargedSek,
        }
      : null;
  const paidState = ['paid', 'held_escrow', 'released', 'refunded'].includes(booking.paymentStatus);
  const canPay = booking.paymentStatus === 'unpaid' || booking.paymentStatus === 'pending';
  const isAwaiting = booking.paymentStatus === 'awaiting_approval';
  const isDeclined = booking.paymentStatus === 'declined';
  const isCancelled = booking.paymentStatus.startsWith('cancelled_');

  return (
    <Card className="payment-handoff-card surface-card border-brand-500/30 bg-card shadow-sm">
      <CardContent className="flex flex-col gap-5 p-6 sm:p-7">
        <div className="grid gap-2">
          <p className="text-eyebrow">{t('eyebrow')}</p>
          <h1 className="font-display text-h2 leading-tight tracking-tight text-foreground">
            {t('title')}
          </h1>
          <p className="text-small text-muted-foreground">
            {t('schedule', { date: formatDate(booking.scheduledAt, locale) })}
          </p>
        </div>

        <dl className="grid gap-3 rounded-xl border border-border bg-muted p-4 sm:grid-cols-2">
          <DetailFact label={t('providerLabel')}>{booking.providerName}</DetailFact>
          <DetailFact label={t('cityLabel')}>{booking.providerCity}</DetailFact>
          <DetailFact label={t('categoryLabel')}>{t(`category.${booking.category}`)}</DetailFact>
          <DetailFact label={t('durationLabel')}>
            {t('duration', { minutes: booking.durationMinutes })}
          </DetailFact>
        </dl>

        <BookingPriceSummary instructorId={booking.instructorId} snapshot={snapshot} />

        <BookingMessagingEntry bookingId={booking.id} />

        {booking.cancellationTerms ? (
          <section className="grid gap-2 rounded-xl border border-border bg-muted p-4">
            <p className="text-eyebrow text-muted-foreground">{t('cancellationTitle')}</p>
            <p className="text-small text-muted-foreground">
              {t('cancellationBody', {
                tier: t(`tier.${booking.cancellationTerms.tier}`),
                hours: booking.cancellationTerms.fullRefundBeforeHours,
              })}
            </p>
          </section>
        ) : null}

        {paidState ? (
          <div className="grid gap-2 rounded-xl border border-brand-500/40 bg-brand-100 px-4 py-4 dark:bg-brand-900">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="text-small font-medium text-foreground">{t('paymentLabel')}</span>
              <Badge className="bg-brand-200 text-brand-700 dark:bg-brand-800 dark:text-brand-300">
                {t(`status.${booking.paymentStatus}`)}
              </Badge>
            </div>
            <p className="text-small text-muted-foreground">
              {booking.paymentStatus === 'held_escrow'
                ? t('heldConfirmation')
                : booking.paymentStatus === 'paid'
                  ? t('paidConfirmation')
                  : booking.paymentStatus === 'refunded'
                    ? t('refundedBody')
                    : null}
            </p>
            {booking.receiptEmailStatus === 'failed' ? (
              <div className="grid gap-1 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2">
                <p className="text-small font-medium text-destructive">
                  {t('receiptDeliveryFailed')}
                </p>
                <p className="text-small text-muted-foreground">{t('receiptDeliveryFailedBody')}</p>
              </div>
            ) : null}
            <Button asChild variant="secondary" size="sm" className="w-fit">
              <Link
                href={`/bookings/${encodeURIComponent(booking.id)}/receipt${token ? `?token=${encodeURIComponent(token)}` : ''}`}
              >
                {t('receiptLink')}
              </Link>
            </Button>
          </div>
        ) : booking.paymentStatus === 'refunded' ? (
          <div className="grid gap-2 rounded-xl border border-brand-500/40 bg-brand-100 px-4 py-4 dark:bg-brand-900">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="text-small font-medium text-foreground">{t('paymentLabel')}</span>
              <Badge variant="outline">{t(`status.${booking.paymentStatus}`)}</Badge>
            </div>
            <p className="text-small text-muted-foreground">{t('refundedBody')}</p>
          </div>
        ) : isAwaiting ? (
          <StateNotice title={t('awaitingTitle')} body={t('awaitingBody')} />
        ) : isDeclined ? (
          <StateNotice title={t('declinedTitle')} body={t('declinedBody')} />
        ) : isCancelled ? (
          <StateNotice title={t('cancelledTitle')} body={t('cancelledBody')} />
        ) : canPay ? (
          <Button
            type="button"
            disabled={status.paymentLoading}
            onClick={() => void startPayment()}
          >
            {status.paymentLoading ? t('openingCheckout') : t('payCta')}
          </Button>
        ) : null}

        {paymentPollError ? (
          <div className="grid gap-3 rounded-xl border border-brand-500/40 bg-brand-100 px-4 py-4 dark:bg-brand-900">
            <div className="grid gap-1">
              <p className="font-display text-h4 font-semibold tracking-tight text-foreground">
                {t('paymentPollTimeoutTitle')}
              </p>
              <p className="text-small text-muted-foreground">{t('paymentPollTimeoutBody')}</p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-fit"
              onClick={() => {
                setPaymentPollError(false);
                setPaymentPollRetryNonce((current) => current + 1);
              }}
            >
              {t('retryPaymentPoll')}
            </Button>
          </div>
        ) : null}
        {status.error ? <p className="text-small text-destructive">{status.error}</p> : null}
        <Link
          href="/contact?topic=payment"
          className="text-small text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          {t('paymentHelp')}
        </Link>
      </CardContent>
    </Card>
  );
}

export const BookingConfirmPayment = BookingPaymentLink;

function DetailFact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-1">
      <dt className="text-caption font-medium uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </dt>
      <dd className="text-small font-medium text-foreground">{children}</dd>
    </div>
  );
}

function StateNotice({ title, body }: { title: string; body: string }) {
  return (
    <div className="grid gap-1 rounded-xl border border-border bg-muted px-4 py-4">
      <p className="font-display text-h4 font-semibold tracking-tight text-foreground">{title}</p>
      <p className="text-small text-muted-foreground">{body}</p>
    </div>
  );
}

function accessHeaders(token: string | undefined): HeadersInit {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function readBooking(id: string, token: string | undefined): Promise<BookingRead> {
  return apiFetch(`/api/bookings/${encodeURIComponent(id)}`, {
    schema: BookingRead,
    headers: accessHeaders(token),
  });
}

function formatDate(iso: string, locale: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat(locale === 'sv' ? 'sv-SE' : 'en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Europe/Stockholm',
  }).format(date);
}
