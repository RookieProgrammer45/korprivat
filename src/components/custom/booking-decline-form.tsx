// @polsia:user-owned — "Instructor declines a Request-mode booking" form.
// Sibling of `<BookingAcceptForm/>` — same shape, the only difference is the
// route it posts to and the optional `reason` field that lets the
// instructor add a one-line explanation that flows back to the learner.
'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { bookingAccessHeaders } from '@/components/custom/booking-access-headers';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { apiFetch } from '@/lib/api-client';
import {
  type BookingDeclineRequest,
  BookingDeclineResponse,
  BookingRead,
} from '@/lib/contracts/bookings';

type Status =
  | { kind: 'loading' }
  | { kind: 'invalid-token' }
  | { kind: 'cant-decline'; reason: string }
  | { kind: 'ready'; booking: BookingRead }
  | { kind: 'declined'; booking: BookingRead }
  | { kind: 'error'; reason: string };

export function BookingDeclineForm({ bookingId, token }: { bookingId: string; token?: string }) {
  const t = useTranslations('bookingDecline');
  const [status, setStatus] = useState<Status>({ kind: 'loading' });
  const [declinedByLabel, setDeclinedByLabel] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    apiFetch(`/api/bookings/${encodeURIComponent(bookingId)}`, {
      schema: BookingRead,
      headers: bookingAccessHeaders(token),
    })
      .then((booking) => {
        if (!active) return;
        if (booking.paymentStatus !== 'awaiting_approval') {
          if (booking.paymentStatus === 'declined') {
            setStatus({ kind: 'declined', booking });
            return;
          }
          setStatus({ kind: 'cant-decline', reason: t('notAwaiting') });
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
    const trimmed = declinedByLabel.trim();
    if (trimmed.length === 0) return;
    setSubmitting(true);
    try {
      const body: BookingDeclineRequest = {
        ...(token ? { token } : {}),
        declinedByLabel: trimmed,
        ...(reason.trim().length > 0 ? { reason: reason.trim() } : {}),
      };
      await apiFetch(`/api/bookings/${encodeURIComponent(bookingId)}/decline`, {
        method: 'POST',
        body: JSON.stringify(body),
        schema: BookingDeclineResponse,
      });
      const fresh = await apiFetch(`/api/bookings/${encodeURIComponent(bookingId)}`, {
        schema: BookingRead,
        headers: bookingAccessHeaders(token),
      });
      setStatus({ kind: 'declined', booking: fresh });
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
  if (
    status.kind === 'invalid-token' ||
    status.kind === 'error' ||
    status.kind === 'cant-decline'
  ) {
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
  if (status.kind === 'declined') {
    return (
      <Card className="surface-panel border-brand-500/40 bg-brand-100 shadow-sm dark:bg-brand-900">
        <CardContent className="flex flex-col gap-3 p-6">
          <p className="font-display text-h3 tracking-tight text-foreground">
            {t('declinedTitle')}
          </p>
          <p className="text-small text-muted-foreground">{t('declinedBody')}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="surface-panel border-brand-500/40 bg-brand-100 shadow-sm dark:bg-brand-900">
      <CardContent className="flex flex-col gap-4 p-6">
        <p className="text-eyebrow">{t('eyebrow')}</p>
        <p className="font-display text-h3 leading-tight tracking-tight text-foreground">
          {t('title')}
        </p>
        <div className="grid gap-1">
          <Label htmlFor="declined-by-label">{t('nameLabel')}</Label>
          <Input
            id="declined-by-label"
            type="text"
            autoComplete="name"
            value={declinedByLabel}
            onChange={(e) => setDeclinedByLabel(e.target.value)}
            required
          />
        </div>
        <div className="grid gap-1">
          <Label htmlFor="declined-reason">{t('reasonLabel')}</Label>
          <Textarea
            id="declined-reason"
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={2000}
            placeholder={t('reasonPlaceholder')}
          />
        </div>
        <div className="dl-action-group">
          <Button
            type="button"
            variant="outline"
            onClick={() => void onSubmit()}
            disabled={submitting || declinedByLabel.trim().length === 0}
            className="border-brand-500/40 bg-brand-100 hover:bg-brand-200 dark:bg-brand-900 dark:hover:bg-brand-800"
          >
            {submitting ? t('submitting') : t('submit')}
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
