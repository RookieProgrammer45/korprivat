// @polsia:user-owned — token-bearing cancellation island.
//
// The server remains authoritative for the cancellation classification and
// writes the final outcome. This island previews the same three policy bands,
// collects the actor label required by the existing action contract, and
// shows a receipt without exposing private settlement details.

'use client';

import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { bookingAccessHeaders } from '@/components/custom/booking-access-headers';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { apiFetch } from '@/lib/api-client';
import {
  type CancellationTier,
  classifyCancellationOutcome,
  computeCancellationFeeUsd,
  getPolicyForTier,
} from '@/lib/business/cancellation-policy';
import {
  type BookingCancelRequest,
  BookingCancelResponse,
  BookingRead,
} from '@/lib/contracts/bookings';
import { sekToUsdChargeAmount } from '@/lib/payments/format-amount';

type Status =
  | { kind: 'loading' }
  | { kind: 'invalid-token' }
  | { kind: 'cant-cancel'; reason: string }
  | {
      kind: 'preview';
      booking: BookingRead;
      previewFee: number | null;
      previewPercent: number;
      tier: CancellationTier;
    }
  | {
      kind: 'cancelled';
      booking: BookingRead;
      fee: number | null;
      outcome: BookingRead['cancellationOutcome'];
    }
  | { kind: 'error'; reason: string };

export function BookingCancelForm({ bookingId, token }: { bookingId: string; token: string }) {
  const t = useTranslations('bookingCancel');
  const tPolicy = useTranslations('cancellationPolicy');
  const locale = useLocale();
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
        if (booking.cancellationOutcome) {
          setStatus({
            kind: 'cancelled',
            booking,
            fee: null,
            outcome: booking.cancellationOutcome,
          });
          return;
        }
        if (booking.paymentStatus === 'released' || booking.paymentStatus === 'refunded') {
          setStatus({ kind: 'cant-cancel', reason: t('states.alreadySettled') });
          return;
        }
        const cancellable = [
          'held_escrow',
          'paid',
          'pending',
          'unpaid',
          'cancelled_full_refund',
          'cancelled_partial',
          'cancelled_late',
          'cancelled_early',
        ].includes(booking.paymentStatus);
        if (!cancellable) {
          setStatus({ kind: 'cant-cancel', reason: t('states.notCancellable') });
          return;
        }

        const tier = cancellationTier(booking.cancellationPolicyTier);
        const policy = getPolicyForTier(tier);
        const classified = classifyCancellationOutcome(
          new Date(),
          new Date(booking.preferredAt),
          policy,
        );
        if (classified.kind === 'past') {
          setStatus({ kind: 'cant-cancel', reason: t('states.lessonStarted') });
          return;
        }
        const lessonChargeUsd = sekToUsdChargeAmount(booking.hourlyRateSek);
        const previewFee =
          classified.feePercent > 0
            ? computeCancellationFeeUsd(lessonChargeUsd, classified.feePercent)
            : null;
        setStatus({
          kind: 'preview',
          booking,
          previewFee,
          previewPercent: classified.feePercent,
          tier,
        });
      })
      .catch((err: unknown) => {
        if (!active) return;
        setStatus({
          kind: 'error',
          reason: isBookingNotFound(err) ? t('states.notFound') : t('states.loadError'),
        });
      });
    return () => {
      active = false;
    };
  }, [bookingId, t, token]);

  const onSubmit = async () => {
    if (status.kind !== 'preview') return;
    const trimmed = actorName.trim();
    if (trimmed.length === 0) {
      toast.error(t('form.nameRequired'));
      return;
    }
    setSubmitting(true);
    try {
      const body: BookingCancelRequest = {
        token,
        cancelledByRole: actorRole,
        cancelledByLabel: trimmed,
      };
      const result = await apiFetch(`/api/bookings/${encodeURIComponent(bookingId)}/cancel`, {
        method: 'POST',
        body: JSON.stringify(body),
        schema: BookingCancelResponse,
      });
      const fresh = await apiFetch(`/api/bookings/${encodeURIComponent(bookingId)}`, {
        schema: BookingRead,
        headers: bookingAccessHeaders(token),
      });
      setStatus({
        kind: 'cancelled',
        booking: fresh,
        fee: result.feeAmountUsd ?? null,
        outcome: result.cancellationOutcome,
      });
      toast.success(t('receipt.toast'));
    } catch (err: unknown) {
      const stateError = readFieldError(err, 'state');
      const tokenError = readFieldError(err, 'token');
      if (stateError) {
        setStatus({ kind: 'cant-cancel', reason: localizeStateError(stateError, t) });
      } else if (tokenError) {
        setStatus({ kind: 'invalid-token' });
      } else {
        toast.error(t('states.submitError'));
        setStatus({ kind: 'error', reason: t('states.submitError') });
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

  if (status.kind === 'error' || status.kind === 'invalid-token') {
    return (
      <Card className="border-destructive/40 bg-destructive/5">
        <CardContent className="flex flex-col gap-2 p-6">
          <p className="font-display text-h3 tracking-tight text-foreground">
            {status.kind === 'invalid-token' ? t('invalidTitle') : t('errorTitle')}
          </p>
          <p className="text-small text-muted-foreground">
            {status.kind === 'invalid-token' ? t('invalidBody') : status.reason}
          </p>
        </CardContent>
      </Card>
    );
  }

  if (status.kind === 'cant-cancel') {
    return (
      <Card className="border-brand-500/40 bg-brand-100 dark:bg-brand-900">
        <CardContent className="flex flex-col gap-2 p-6">
          <p className="font-display text-h3 tracking-tight text-foreground">
            {t('cantCancelTitle')}
          </p>
          <p className="text-small text-muted-foreground">{status.reason}</p>
        </CardContent>
      </Card>
    );
  }

  if (status.kind === 'cancelled') {
    const hasFee =
      (status.fee ?? 0) > 0 ||
      status.outcome === 'cancelled_late' ||
      status.outcome === 'cancelled_partial';
    return (
      <Card className="surface-panel border-border bg-card shadow-sm">
        <CardContent className="flex flex-col gap-3 p-6">
          <Badge
            className={
              hasFee
                ? 'bg-brand-100 text-brand-700 dark:bg-brand-900 dark:text-brand-300'
                : 'bg-brand-100 text-brand-700 dark:bg-brand-900 dark:text-brand-300'
            }
          >
            {t('receipt.badge')}
          </Badge>
          <p className="font-display text-h3 tracking-tight text-foreground">
            {hasFee ? t('receipt.withFee', { fee: status.fee ?? 0 }) : t('receipt.withoutFee')}
          </p>
          <p className="text-small text-muted-foreground">{t('receipt.body')}</p>
          <Link
            href="/instructors"
            className="text-small font-medium text-brand-700 underline-offset-4 hover:underline dark:text-brand-300"
          >
            {t('receipt.browseCta')}
          </Link>
        </CardContent>
      </Card>
    );
  }

  const hasFee = status.previewFee !== null && status.previewFee > 0;
  const policy = getPolicyForTier(status.tier);
  return (
    <Card className="surface-card border-brand-500/30 bg-card shadow-sm">
      <CardContent className="flex flex-col gap-5 p-6">
        <header className="grid gap-2">
          <p className="text-eyebrow">{t('eyebrow')}</p>
          <h1 className="font-display text-h2 leading-tight tracking-tight text-foreground">
            {t('title')}
          </h1>
          <p className="text-small text-muted-foreground">
            {t('schedule', { date: formatDate(status.booking.preferredAt, locale) })}
          </p>
        </header>

        <section className="grid gap-3 rounded-lg border border-border bg-muted p-4">
          <div>
            <p className="text-eyebrow text-muted-foreground">{t('policyEyebrow')}</p>
            <p className="mt-1 font-display text-h4 font-semibold tracking-tight text-foreground">
              {tPolicy(`${status.tier}.name`)}
            </p>
            <p className="mt-1 text-small text-muted-foreground">
              {tPolicy(`${status.tier}.summary`)}
            </p>
          </div>
          <ul className="grid gap-2 text-small text-foreground">
            <li>{t('policy.fullRefund', { hours: policy.fullRefundBeforeHours })}</li>
            {policy.partialFeePercent > 0 ? (
              <li>
                {t('policy.partial', {
                  from: policy.fullFeeWindowHours,
                  to: policy.fullRefundBeforeHours,
                  percent: policy.partialFeePercent,
                })}
              </li>
            ) : null}
            <li>{t('policy.late', { hours: policy.fullFeeWindowHours })}</li>
          </ul>
          <Link
            href="/faq"
            className="w-fit text-small font-medium text-brand-700 underline-offset-4 hover:underline dark:text-brand-300"
          >
            {t('policy.moreDetails')}
          </Link>
        </section>

        {hasFee && status.previewFee !== null ? (
          <div className="grid gap-1 rounded-lg border border-brand-500/35 bg-brand-100 p-4 dark:bg-brand-900">
            <p className="text-small font-medium text-brand-700 dark:text-brand-300">
              {status.previewPercent >= 100 ? t('fee.full') : t('fee.partial')}
            </p>
            <p className="font-display text-h4 text-foreground">
              {t('fee.amount', { fee: status.previewFee })}
            </p>
          </div>
        ) : (
          <p className="text-body text-muted-foreground">{t('fee.none')}</p>
        )}

        <div className="grid gap-3 rounded-lg border border-border bg-muted p-4">
          <label htmlFor="cancellation-actor-name" className="grid gap-2">
            <span className="text-caption font-medium uppercase tracking-[0.12em] text-muted-foreground">
              {t('form.nameLabel')}
            </span>
            <Input
              id="cancellation-actor-name"
              type="text"
              autoComplete="name"
              value={actorName}
              onChange={(event) => setActorName(event.target.value)}
              required
            />
          </label>
          <fieldset className="grid gap-2">
            <legend className="text-caption font-medium uppercase tracking-[0.12em] text-muted-foreground">
              {t('form.roleLabel')}
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
                  {t(`form.roles.${role}`)}
                </Button>
              ))}
            </div>
          </fieldset>
        </div>
        <Button type="button" onClick={() => void onSubmit()} disabled={submitting}>
          {submitting ? t('form.submitting') : t('form.submit')}
        </Button>
      </CardContent>
    </Card>
  );
}

function cancellationTier(tier: string | null): CancellationTier {
  return tier === 'moderate' || tier === 'strict' ? tier : 'flexible';
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
  t: ReturnType<typeof useTranslations<'bookingCancel'>>,
): string {
  const lower = message.toLowerCase();
  if (lower.includes('already settled')) return t('states.alreadySettled');
  if (lower.includes('already started')) return t('states.lessonStarted');
  if (lower.includes('state changed')) return t('states.submitError');
  return t('states.notCancellable');
}
