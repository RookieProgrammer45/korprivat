'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { bookingAccessHeaders } from '@/components/custom/booking-access-headers';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { apiFetch } from '@/lib/api-client';
import {
  type BookingDisputeOpenRequest,
  type BookingDisputeResolveRequest,
  BookingDisputeResponse,
  BookingRead,
} from '@/lib/contracts/bookings';

type Status =
  | { kind: 'loading' }
  | { kind: 'invalid-token' }
  | { kind: 'inert'; reason: string }
  | { kind: 'open-form'; booking: BookingRead }
  | { kind: 'opened'; booking: BookingRead }
  | { kind: 'resolve-form'; booking: BookingRead }
  | { kind: 'resolved'; booking: BookingRead; outcome: 'released' | 'refunded' }
  | { kind: 'error'; reason: string };

const REASON_MAX = 2000;

export function BookingDisputeForm({ bookingId, token }: { bookingId: string; token: string }) {
  const t = useTranslations('bookingDispute');
  const [status, setStatus] = useState<Status>({ kind: 'loading' });
  const [actorName, setActorName] = useState('');
  const [actorRole, setActorRole] = useState<'learner' | 'instructor'>('learner');
  const [reason, setReason] = useState('');
  const [resolveNote, setResolveNote] = useState('');
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
        if (booking.paymentStatus === 'released') {
          setStatus({
            kind: 'inert',
            reason: t('inert.released'),
          });
          return;
        }
        if (booking.paymentStatus === 'refunded') {
          setStatus({
            kind: 'inert',
            reason: t('inert.refunded'),
          });
          return;
        }
        if (booking.disputeStatus === 'open') {
          setStatus({ kind: 'resolve-form', booking });
          return;
        }
        if (booking.disputeStatus === 'resolved_released') {
          setStatus({
            kind: 'inert',
            reason: t('inert.resolved_released'),
          });
          return;
        }
        if (booking.disputeStatus === 'resolved_refunded') {
          setStatus({
            kind: 'inert',
            reason: t('inert.resolved_refunded'),
          });
          return;
        }
        if (booking.paymentStatus !== 'held_escrow') {
          setStatus({
            kind: 'inert',
            reason: t('inert.notHeld'),
          });
          return;
        }
        setStatus({ kind: 'open-form', booking });
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

  const onOpen = async () => {
    if (status.kind !== 'open-form') return;
    const trimmedName = actorName.trim();
    const trimmedReason = reason.trim();
    if (trimmedName.length === 0 || trimmedReason.length === 0) {
      return;
    }
    setSubmitting(true);
    try {
      await apiFetch(`/api/bookings/${encodeURIComponent(bookingId)}/dispute`, {
        method: 'POST',
        body: JSON.stringify({
          token,
          openedByRole: actorRole,
          openedByLabel: trimmedName,
          reason: trimmedReason,
        } satisfies BookingDisputeOpenRequest),
        schema: BookingDisputeResponse,
      });
      const fresh = await apiFetch(`/api/bookings/${encodeURIComponent(bookingId)}`, {
        schema: BookingRead,
        headers: bookingAccessHeaders(token),
      });
      setStatus({ kind: 'opened', booking: fresh });
    } catch (err: unknown) {
      const state = readFieldError(err, 'state');
      const tokenError = readFieldError(err, 'token');
      if (state) {
        setStatus({ kind: 'inert', reason: localizeStateError(state, t) });
        return;
      }
      if (tokenError) {
        setStatus({ kind: 'invalid-token' });
        return;
      }
      setStatus({ kind: 'error', reason: t('openError') });
    } finally {
      setSubmitting(false);
    }
  };

  const onResolve = async (outcome: 'released' | 'refunded') => {
    if (status.kind !== 'resolve-form') return;
    const trimmedName = actorName.trim();
    if (trimmedName.length === 0) {
      return;
    }
    setSubmitting(true);
    try {
      const body: BookingDisputeResolveRequest = {
        token,
        outcome,
        resolvedByLabel: trimmedName,
        ...(resolveNote.trim().length > 0 ? { resolutionNote: resolveNote.trim() } : {}),
      };
      await apiFetch(`/api/bookings/${encodeURIComponent(bookingId)}/dispute/resolve`, {
        method: 'POST',
        body: JSON.stringify(body),
        schema: BookingDisputeResponse,
      });
      const fresh = await apiFetch(`/api/bookings/${encodeURIComponent(bookingId)}`, {
        schema: BookingRead,
        headers: bookingAccessHeaders(token),
      });
      setStatus({ kind: 'resolved', booking: fresh, outcome });
    } catch (err: unknown) {
      const state = readFieldError(err, 'state');
      const tokenError = readFieldError(err, 'token');
      if (state) {
        setStatus({ kind: 'inert', reason: localizeStateError(state, t) });
        return;
      }
      if (tokenError) {
        setStatus({ kind: 'invalid-token' });
        return;
      }
      setStatus({ kind: 'error', reason: t('resolveError') });
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
            {status.kind === 'invalid-token' ? t('invalidAction') : t('error')}
          </p>
          <p className="text-small text-muted-foreground">
            {status.kind === 'invalid-token' ? t('invalidActionBody') : status.reason}
          </p>
        </CardContent>
      </Card>
    );
  }

  if (status.kind === 'inert') {
    return (
      <Card className="border-brand-500/40 bg-brand-100 dark:bg-brand-900">
        <CardContent className="flex flex-col gap-2 p-6">
          <p className="font-display text-h3 tracking-tight text-foreground">{t('inertTitle')}</p>
          <p className="text-small text-muted-foreground">{status.reason}</p>
        </CardContent>
      </Card>
    );
  }

  if (status.kind === 'opened') {
    return (
      <Card className="border-brand-500/40 bg-brand-100 shadow-sm dark:bg-brand-900">
        <CardContent className="flex flex-col gap-3 p-6">
          <Badge className="w-fit bg-brand-200 text-brand-700 dark:bg-brand-800 dark:text-brand-300">
            {t('openedBadge')}
          </Badge>
          <p className="font-display text-h3 tracking-tight text-foreground">{t('openedTitle')}</p>
          <p className="text-small text-muted-foreground">{t('openedBody')}</p>
        </CardContent>
      </Card>
    );
  }

  if (status.kind === 'resolved') {
    return (
      <Card className="surface-panel border-emerald-500/40 bg-emerald-500/5 shadow-md">
        <CardContent className="flex flex-col gap-3 p-6">
          <Badge className="w-fit bg-emerald-500/20 text-emerald-700 dark:text-emerald-300">
            {t('resolvedBadge')}
          </Badge>
          <p className="font-display text-h3 tracking-tight text-foreground">
            {status.outcome === 'released' ? t('releasedTitle') : t('refundedTitle')}
          </p>
          <p className="text-small text-muted-foreground">
            {status.outcome === 'refunded' ? t('refundedBody') : t('resolvedBody')}
          </p>
        </CardContent>
      </Card>
    );
  }

  if (status.kind === 'resolve-form') {
    return (
      <Card className="border-brand-500/40 bg-brand-100 shadow-sm dark:bg-brand-900">
        <CardContent className="flex flex-col gap-4 p-6">
          <Badge className="w-fit bg-brand-200 text-brand-700 dark:bg-brand-800 dark:text-brand-300">
            {t('openedBadge')}
          </Badge>
          <p className="font-display text-h3 tracking-tight text-foreground">
            {t('resolveFormTitle')}
          </p>
          <p className="text-small text-muted-foreground">{t('resolveFormLead')}</p>
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
            <label className="grid gap-1">
              <span className="text-caption font-medium uppercase tracking-[0.12em] text-muted-foreground">
                {t('noteLabel')}
              </span>
              <textarea
                value={resolveNote}
                onChange={(e) => setResolveNote(e.target.value.slice(0, 1000))}
                rows={3}
                className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </label>
          </div>
          <div className="dl-action-group">
            <Button
              type="button"
              variant="outline"
              onClick={() => onResolve('refunded')}
              disabled={submitting || actorName.trim().length === 0}
            >
              {submitting ? t('resolving') : t('resolveRefund')}
            </Button>
            <Button
              type="button"
              onClick={() => onResolve('released')}
              disabled={submitting || actorName.trim().length === 0}
            >
              {t('resolveRelease')}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // status.kind === 'open-form'
  return (
    <Card className="surface-card border-brand-500/30 bg-card shadow-sm">
      <CardContent className="flex flex-col gap-4 p-6">
        <p className="text-eyebrow">{t('openFormEyebrow')}</p>
        <p className="font-display text-h3 leading-tight tracking-tight text-foreground">
          {t('openFormTitle')}
        </p>
        <p className="text-body text-muted-foreground">{t('openFormLead')}</p>
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
          <label className="grid gap-1">
            <span className="text-caption font-medium uppercase tracking-[0.12em] text-muted-foreground">
              {t('reasonLabel')}
            </span>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value.slice(0, REASON_MAX))}
              rows={5}
              required
              placeholder={t('reasonPlaceholder')}
              className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
            <span className="text-caption text-muted-foreground">
              {t('reasonCounter', { count: reason.length, max: REASON_MAX })}
            </span>
          </label>
        </div>
        <Button
          type="button"
          onClick={onOpen}
          disabled={submitting || actorName.trim().length === 0 || reason.trim().length === 0}
        >
          {submitting ? t('opening') : t('openSubmit')}
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

function localizeStateError(
  message: string,
  t: ReturnType<typeof useTranslations<'bookingDispute'>>,
): string {
  const lower = message.toLowerCase();
  if (lower.includes('already open')) return t('inert.alreadyOpen');
  if (lower.includes('no open dispute')) return t('inert.notOpen');
  if (lower.includes('before payout release')) return t('inert.notHeld');
  return t('error');
}
