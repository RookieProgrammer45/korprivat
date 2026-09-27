// Mirrors the shape of `<BookingCancelForm/>` the deep-link `cancel` page
// hosts — reads the booking (to verify the row exists / hasn't been
// terminal-committed already), then renders a state machine that POSTs
// to /api/bookings/[id]/accept with the `acceptedByLabel` label.
'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { bookingAccessHeaders } from '@/components/custom/booking-access-headers';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { apiFetch } from '@/lib/api-client';
import {
  type BookingAcceptRequest,
  BookingAcceptResponse,
  BookingRead,
} from '@/lib/contracts/bookings';

type Status =
  | { kind: 'loading' }
  | { kind: 'invalid-token' }
  | { kind: 'cant-accept'; reason: string }
  | { kind: 'ready'; booking: BookingRead }
  | { kind: 'accepted'; booking: BookingRead; actionUrl?: string | null }
  | { kind: 'error'; reason: string };

export function BookingAcceptForm({ bookingId, token }: { bookingId: string; token?: string }) {
  const t = useTranslations('bookingAccept');
  const [status, setStatus] = useState<Status>({ kind: 'loading' });
  const [acceptedByLabel, setAcceptedByLabel] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    apiFetch(`/api/bookings/${encodeURIComponent(bookingId)}`, {
      schema: BookingRead,
      headers: bookingAccessHeaders(token),
    })
      .then((booking) => {
        if (!active) return;
        // Already approved (or terminal) — surface a coherent "booking
        // already in flight" state rather than letting the form render
        // an "Approve" CTA on a row that's no longer awaiting.
        if (booking.paymentStatus !== 'awaiting_approval') {
          if (booking.paymentStatus === 'declined') {
            setStatus({ kind: 'cant-accept', reason: t('declined') });
            return;
          }
          if (
            booking.paymentStatus === 'pending' ||
            booking.paymentStatus === 'held_escrow' ||
            booking.paymentStatus === 'released'
          ) {
            setStatus({ kind: 'accepted', booking, actionUrl: null });
            return;
          }
          setStatus({ kind: 'cant-accept', reason: t('notAwaiting') });
          return;
        }
        setStatus({ kind: 'ready', booking });
      })
      .catch((err: unknown) => {
        if (!active) return;
        if (readFieldError(err, 'id') === 'Booking not found') {
          setStatus({ kind: 'error', reason: t('notFound') });
          return;
        }
        setStatus({ kind: 'error', reason: t('loadError') });
      });
    return () => {
      active = false;
    };
  }, [bookingId, t, token]);

  const onSubmit = async () => {
    if (status.kind !== 'ready') return;
    const trimmed = acceptedByLabel.trim();
    if (trimmed.length === 0) return;
    setSubmitting(true);
    try {
      const body: BookingAcceptRequest = {
        ...(token ? { token } : {}),
        acceptedByLabel: trimmed,
      };
      const result: BookingAcceptResponse = await apiFetch(
        `/api/bookings/${encodeURIComponent(bookingId)}/accept`,
        {
          method: 'POST',
          body: JSON.stringify(body),
          schema: BookingAcceptResponse,
        },
      );
      // Acceptance rotates both the instructor action token and the learner
      // access hash. Read the new learner token from the returned canonical
      // detail URL before refreshing; the old email action token is no longer
      // valid after a successful transition.
      const nextToken = result.actionUrl
        ? (new URL(result.actionUrl, window.location.origin).searchParams.get('token') ?? token)
        : token;
      try {
        const fresh = await apiFetch(`/api/bookings/${encodeURIComponent(bookingId)}`, {
          schema: BookingRead,
          headers: bookingAccessHeaders(nextToken),
        });
        setStatus({ kind: 'accepted', booking: fresh, actionUrl: result.actionUrl });
      } catch {
        // The state transition already committed. Keep the returned CTA
        // usable even if the follow-up read is transiently unavailable.
        setStatus({
          kind: 'accepted',
          booking: BookingRead.parse({ ...status.booking, paymentStatus: result.paymentStatus }),
          actionUrl: result.actionUrl,
        });
      }
    } catch (err: unknown) {
      const tokenError = readFieldError(err, 'token');
      if (tokenError) {
        setStatus({ kind: 'invalid-token' });
      } else {
        setStatus({ kind: 'error', reason: t('submitError') });
      }
    } finally {
      setSubmitting(false);
    }
  };

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
  if (status.kind === 'invalid-token' || status.kind === 'error' || status.kind === 'cant-accept') {
    return (
      <Card className="border-brand-500/40 bg-brand-100 dark:bg-brand-900">
        <CardContent className="flex flex-col gap-2 p-6">
          <p className="font-display text-h3 tracking-tight text-foreground">
            {status.kind === 'invalid-token' ? t('invalidTitle') : t('cantTitle')}
          </p>
          <p className="text-small text-muted-foreground">
            {status.kind === 'invalid-token'
              ? t('invalidBody')
              : 'reason' in status
                ? status.reason
                : ''}
          </p>
        </CardContent>
      </Card>
    );
  }
  if (status.kind === 'accepted') {
    const bookingUrl =
      status.actionUrl ??
      `/bookings/${encodeURIComponent(status.booking.id)}${
        token ? `?token=${encodeURIComponent(token)}` : ''
      }`;
    return (
      <Card className="surface-card border-brand-500/30 bg-card shadow-sm">
        <CardContent className="flex flex-col gap-3 p-6">
          <p className="font-display text-h3 tracking-tight text-foreground">
            {t('acceptedTitle')}
          </p>
          <p className="text-small text-muted-foreground">{t('acceptedBody')}</p>
          <Button asChild size="sm" className="w-fit">
            <Link href={bookingUrl}>{t('continueToPayment')}</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="surface-card border-brand-500/30 bg-card shadow-sm">
      <CardContent className="flex flex-col gap-4 p-6">
        <p className="text-eyebrow">{t('eyebrow')}</p>
        <p className="font-display text-h3 leading-tight tracking-tight text-foreground">
          {t('title')}
        </p>
        <p className="text-small text-muted-foreground">
          {t('bookingId', { id: status.booking.id })}
        </p>
        <Label htmlFor="accepted-by-label">{t('nameLabel')}</Label>
        <div className="grid gap-1">
          <Input
            id="accepted-by-label"
            type="text"
            autoComplete="name"
            value={acceptedByLabel}
            onChange={(e) => setAcceptedByLabel(e.target.value)}
            required
          />
        </div>
        <div className="dl-action-group flex-col sm:flex-row sm:items-center">
          <Button
            type="button"
            onClick={onSubmit}
            disabled={submitting || acceptedByLabel.trim().length === 0}
          >
            {submitting ? t('submitting') : t('submit')}
          </Button>
          <Button asChild type="button" variant="outline">
            <Link
              href={`/bookings/${encodeURIComponent(bookingId)}/decline${
                token ? `?token=${encodeURIComponent(token)}` : ''
              }`}
            >
              {t('declineInstead')}
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function readFieldError(err: unknown, field: string): string | null {
  const cause = err instanceof Error ? err.cause : null;
  if (!cause || typeof cause !== 'object' || cause === null) return null;
  const errors = (cause as { errors?: Record<string, string | undefined> }).errors;
  const value = errors?.[field];
  return typeof value === 'string' && value.length > 0 ? value : null;
}
