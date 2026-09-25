'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { bookingAccessHeaders } from '@/components/custom/booking-access-headers';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { apiFetch } from '@/lib/api-client';
import { BookingCompleteResponse, BookingRead } from '@/lib/contracts/bookings';

type Status =
  | { kind: 'loading' }
  | { kind: 'invalid-token' }
  | { kind: 'cant-complete'; reason: string }
  | { kind: 'ready'; booking: BookingRead }
  | { kind: 'done'; booking: BookingRead }
  | { kind: 'error'; reason: string };

export function BookingCompleteForm({ bookingId, token }: { bookingId: string; token: string }) {
  const t = useTranslations('bookingComplete');
  const [status, setStatus] = useState<Status>({ kind: 'loading' });
  const [actorName, setActorName] = useState('');
  const [actorRole, setActorRole] = useState<'learner' | 'instructor'>('learner');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    apiFetch(`/api/bookings/${encodeURIComponent(bookingId)}`, {
      schema: BookingRead,
      headers: bookingAccessHeaders(token),
    })
      .then((booking) => {
        if (!active) return;
        if (!token) {
          setStatus({ kind: 'invalid-token' });
          return;
        }
        if (booking.paymentStatus !== 'held_escrow' || booking.disputeStatus === 'open') {
          setStatus({
            kind: 'cant-complete',
            reason: booking.disputeStatus === 'open' ? t('disputeOpen') : t('notEscrow'),
          });
          return;
        }
        setStatus({ kind: 'ready', booking });
      })
      .catch((err: unknown) => {
        if (!active) return;
        if (isBookingNotFound(err)) {
          setStatus({ kind: 'error', reason: t('notFound') });
          return;
        }
        setStatus({ kind: 'error', reason: t('loadError') });
      });
    return () => {
      active = false;
    };
  }, [bookingId, token, t]);

  const onSubmit = async () => {
    if (status.kind !== 'ready') return;
    const trimmed = actorName.trim();
    if (trimmed.length === 0) {
      setStatus({
        kind: 'cant-complete',
        reason: t('nameRequired'),
      });
      return;
    }
    setSubmitting(true);
    try {
      await apiFetch(`/api/bookings/${encodeURIComponent(bookingId)}/complete`, {
        method: 'POST',
        body: JSON.stringify({
          token,
          completedByRole: actorRole,
          completedByLabel: trimmed,
        }),
        schema: BookingCompleteResponse,
      });
      const fresh = await apiFetch(`/api/bookings/${encodeURIComponent(bookingId)}`, {
        schema: BookingRead,
        headers: bookingAccessHeaders(token),
      });
      setStatus({ kind: 'done', booking: fresh });
    } catch (err: unknown) {
      const stateError = readFieldError(err, 'state');
      const tokenError = readFieldError(err, 'token');
      if (stateError) {
        setStatus({ kind: 'cant-complete', reason: t('notEscrow') });
      } else if (tokenError) {
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
          <div className="h-6 w-1/3 animate-pulse rounded-md bg-muted" />
          <div className="h-4 w-2/3 animate-pulse rounded-md bg-muted" />
          <div className="mt-2 h-9 w-1/2 animate-pulse rounded-md bg-muted" />
        </CardContent>
      </Card>
    );
  }

  if (status.kind === 'error' || status.kind === 'invalid-token') {
    return (
      <Card className="border-destructive/40 bg-destructive/5">
        <CardContent className="flex flex-col gap-2 p-6">
          <p className="font-display text-h3 tracking-tight text-foreground">
            {status.kind === 'invalid-token' ? t('invalidAction') : t('errorTitle')}
          </p>
          <p className="text-small text-muted-foreground">
            {status.kind === 'invalid-token' ? t('invalidActionBody') : status.reason}
          </p>
        </CardContent>
      </Card>
    );
  }

  if (status.kind === 'done') {
    return (
      <Card className="surface-panel border-emerald-500/40 bg-emerald-500/5 shadow-md">
        <CardContent className="flex flex-col gap-3 p-6">
          <div className="flex items-center gap-3">
            <Badge className="bg-emerald-500/20 text-emerald-700 dark:text-emerald-300">
              {t('releasedBadge')}
            </Badge>
          </div>
          <p className="font-display text-h3 tracking-tight text-foreground">
            {t('releasedTitle')}
          </p>
          <p className="text-small text-muted-foreground">{t('releasedBody')}</p>
        </CardContent>
      </Card>
    );
  }

  if (status.kind === 'cant-complete') {
    return (
      <Card className="border-brand-500/40 bg-brand-100 dark:bg-brand-900">
        <CardContent className="flex flex-col gap-2 p-6">
          <p className="font-display text-h3 tracking-tight text-foreground">
            {t('cantCompleteTitle')}
          </p>
          <p className="text-small text-muted-foreground">{status.reason}</p>
        </CardContent>
      </Card>
    );
  }

  // status.kind === 'ready'
  return (
    <Card className="surface-card border-brand-500/30 bg-card shadow-sm">
      <CardContent className="flex flex-col gap-4 p-6">
        <p className="text-eyebrow">{t('eyebrow')}</p>
        <p className="font-display text-h3 leading-tight tracking-tight text-foreground">
          {t('title')}
        </p>
        <p className="text-body text-muted-foreground">{t('body')}</p>
        <div className="grid gap-3 rounded-md border border-border bg-muted p-4">
          <label className="grid gap-1">
            <span className="text-caption font-medium uppercase tracking-[0.12em] text-muted-foreground">
              {t('nameLabel')}
            </span>
            <input
              type="text"
              autoComplete="name"
              value={actorName}
              onChange={(e) => setActorName(e.target.value)}
              required
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </label>
          <fieldset className="grid gap-2">
            <legend className="text-caption font-medium uppercase tracking-[0.12em] text-muted-foreground">
              {t('youAreLabel')}
            </legend>
            <div className="dl-action-group">
              {(['learner', 'instructor'] as const).map((role) => (
                <Button
                  key={role}
                  type="button"
                  variant={actorRole === role ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setActorRole(role)}
                  disabled={submitting}
                >
                  {role === 'learner' ? t('youAreLearner') : t('youAreInstructor')}
                </Button>
              ))}
            </div>
          </fieldset>
        </div>
        <Button type="button" onClick={onSubmit} disabled={submitting}>
          {submitting ? t('submitting') : t('submit')}
        </Button>
      </CardContent>
    </Card>
  );
}

type ErrorEnvelope = { errors?: Record<string, string | undefined> };

function readFieldError(err: unknown, field: string): string | null {
  const cause = err instanceof Error ? err.cause : null;
  if (!cause || typeof cause !== 'object') return null;
  const errors = (cause as ErrorEnvelope).errors;
  const value = errors?.[field];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function isBookingNotFound(err: unknown): boolean {
  return readFieldError(err, 'id') === 'Booking not found';
}
