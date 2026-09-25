// @polsia:user-owned — shared provider operations island for both roles.
'use client';

import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { apiFetch } from '@/lib/api-client';
import { formatProviderDate } from '@/lib/business/provider-timezone';
import { AvailabilitySlotList } from '@/lib/contracts/availability';
import { InstructorMe, type InstructorMe as InstructorMeData } from '@/lib/contracts/instructors';
import {
  ProviderActionResponse,
  type ProviderBookingItem,
  ProviderBookingList,
  type ProviderProfile,
} from '@/lib/contracts/provider-operations';

type State =
  | { kind: 'loading' }
  | {
      kind: 'ready';
      provider: ProviderProfile;
      bookings: ProviderBookingItem[];
      availabilityCount: number;
    }
  | { kind: 'empty' }
  | { kind: 'error' };

export function ProviderOperations() {
  const t = useTranslations('providerOperations');
  const locale = useLocale() === 'en' ? 'en' : 'sv';
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setState({ kind: 'loading' });
    try {
      let me: InstructorMeData;
      try {
        me = await apiFetch('/api/instructors/me', { schema: InstructorMe });
      } catch (error) {
        const cause = error instanceof Error ? error.cause : null;
        const missing =
          cause && typeof cause === 'object' && 'errors' in cause
            ? (cause as { errors?: { id?: unknown } }).errors?.id
            : null;
        if (typeof missing === 'string' && missing.startsWith('No instructor row')) {
          setState({ kind: 'empty' });
          return;
        }
        throw error;
      }
      const [availability, bookingList] = await Promise.all([
        apiFetch('/api/instructor-availability', { schema: AvailabilitySlotList }),
        apiFetch('/api/bookings/instructor?state=all', { schema: ProviderBookingList }),
      ]);
      const provider: ProviderProfile = {
        id: me.id,
        name: me.name,
        city: me.city,
        providerRole: me.providerRole,
        timezone: me.timezone,
        setupComplete: me.setupComplete,
        bookingMode: me.bookingMode ?? 'instant',
        cancellationPolicyTier: me.cancellationPolicyTier ?? 'flexible',
      };
      setState({
        kind: 'ready',
        provider,
        bookings: bookingList.items,
        availabilityCount: availability.items.length,
      });
    } catch {
      setState({ kind: 'error' });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function mutate(
    booking: ProviderBookingItem,
    action: 'accept' | 'decline' | 'cancel' | 'complete',
  ) {
    if (state.kind !== 'ready') return;
    setBusyId(booking.id);
    try {
      const endpoint = `/api/bookings/${encodeURIComponent(booking.id)}/${action}`;
      await apiFetch(endpoint, {
        method: 'POST',
        body: JSON.stringify(
          action === 'accept'
            ? { acceptedByLabel: state.provider.name }
            : action === 'decline'
              ? { declinedByLabel: state.provider.name }
              : action === 'complete'
                ? { completedByLabel: state.provider.name }
                : { cancelledByLabel: state.provider.name },
        ),
        schema: ProviderActionResponse,
      });
      toast.success(t(`actions.${action}Success`));
      await load();
    } catch {
      toast.error(t('actionError'));
    } finally {
      setBusyId(null);
    }
  }

  if (state.kind === 'loading') return <Skeleton className="h-96 w-full rounded-xl" />;
  if (state.kind === 'error') {
    return (
      <Card className="border-destructive/40 bg-card">
        <CardContent className="flex flex-col gap-3 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-display text-h4">{t('errorTitle')}</p>
            <p className="text-small text-muted-foreground">{t('errorBody')}</p>
          </div>
          <Button type="button" variant="outline" onClick={() => void load()}>
            {t('retry')}
          </Button>
        </CardContent>
      </Card>
    );
  }
  if (state.kind === 'empty') {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-body">{t('setup.empty')}</p>
          <Button asChild className="mt-4">
            <Link href="/instructors/new">{t('setup.cta')}</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const { provider, bookings, availabilityCount } = state;
  const requests = bookings.filter(
    (booking) => booking.capabilities.canAccept || booking.capabilities.canDecline,
  );
  const upcoming = bookings.filter(
    (booking) =>
      booking.paymentStatus !== 'declined' && !booking.paymentStatus.startsWith('cancelled_'),
  );
  return (
    <div className="grid gap-6">
      {!provider.setupComplete ? (
        <Card className="border-brand-500/40 bg-brand-100 dark:bg-brand-900">
          <CardContent className="flex flex-col gap-3 p-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-display text-h4">{t('setup.title')}</p>
              <p className="text-small text-muted-foreground">{t('setup.body')}</p>
            </div>
            <Button asChild>
              <Link href="/instructors/new">{t('setup.cta')}</Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}
      <Card className="surface-panel border-border bg-card">
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle>
              {provider.providerRole === 'HANDLEDARE' ? t('handledareTitle') : t('instructorTitle')}
            </CardTitle>
            <CardDescription>
              {provider.city} · {t('timezone', { timezone: provider.timezone })}
            </CardDescription>
          </div>
          <Button asChild variant="secondary" size="sm">
            <Link
              href={
                provider.providerRole === 'HANDLEDARE'
                  ? '/dashboard/handledare/availability'
                  : '/dashboard/instructor/availability'
              }
            >
              {t('availabilityCta')}
            </Link>
          </Button>
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-3">
          <Metric label={t('availabilityCount')} value={String(availabilityCount)} />
          <Metric label={t('requestCount')} value={String(requests.length)} />
          <Metric label={t('bookingCount')} value={String(upcoming.length)} />
        </CardContent>
      </Card>
      <section className="grid gap-3">
        <div>
          <p className="text-eyebrow text-muted-foreground">{t('requestsEyebrow')}</p>
          <h2 className="font-display text-h3">{t('requestsTitle')}</h2>
        </div>
        {requests.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-small text-muted-foreground">
              {t('requestsEmpty')}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3">
            {requests.map((booking) => (
              <BookingCard
                key={booking.id}
                booking={booking}
                provider={provider}
                busy={busyId === booking.id}
                locale={locale}
                t={t}
                onAction={mutate}
              />
            ))}
          </div>
        )}
      </section>
      <section className="grid gap-3">
        <div>
          <p className="text-eyebrow text-muted-foreground">{t('scheduleEyebrow')}</p>
          <h2 className="font-display text-h3">{t('scheduleTitle')}</h2>
        </div>
        {upcoming.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-small text-muted-foreground">
              {t('scheduleEmpty')}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3">
            {upcoming.map((booking) => (
              <BookingCard
                key={booking.id}
                booking={booking}
                provider={provider}
                busy={busyId === booking.id}
                locale={locale}
                t={t}
                onAction={mutate}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-muted/40 p-4">
      <p className="text-caption text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-h3 tabular-nums">{value}</p>
    </div>
  );
}

function BookingCard({
  booking,
  provider,
  busy,
  locale,
  t,
  onAction,
}: {
  booking: ProviderBookingItem;
  provider: ProviderProfile;
  busy: boolean;
  locale: 'sv' | 'en';
  t: ReturnType<typeof useTranslations<'providerOperations'>>;
  onAction: (
    booking: ProviderBookingItem,
    action: 'accept' | 'decline' | 'cancel' | 'complete',
  ) => void;
}) {
  const date = formatProviderDate(booking.scheduledAt, locale, provider.timezone);
  return (
    <Card className="surface-card border-border bg-card">
      <CardContent className="grid gap-4 p-5 lg:grid-cols-[1fr_auto] lg:items-center">
        <div className="grid gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-display text-lg font-semibold">{booking.counterpartyName}</p>
            <Badge variant="outline">{statusLabel(booking.paymentStatus, t)}</Badge>
          </div>
          <p className="text-small text-muted-foreground">
            {booking.category} · {date} · {t('duration', { minutes: booking.durationMinutes })}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 lg:justify-end">
          {booking.capabilities.canAccept ? (
            <Button
              type="button"
              size="sm"
              disabled={busy}
              onClick={() => onAction(booking, 'accept')}
            >
              {t('actions.accept')}
            </Button>
          ) : null}
          {booking.capabilities.canDecline ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => onAction(booking, 'decline')}
            >
              {t('actions.decline')}
            </Button>
          ) : null}
          {booking.capabilities.canComplete ? (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={busy}
              onClick={() => onAction(booking, 'complete')}
            >
              {t('actions.complete')}
            </Button>
          ) : null}
          {booking.capabilities.canCancel ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={busy}
              onClick={() => onAction(booking, 'cancel')}
            >
              {t('actions.cancel')}
            </Button>
          ) : null}
          <Button asChild size="sm" variant="ghost">
            <Link href={`/bookings/${encodeURIComponent(booking.id)}`}>{t('open')}</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function statusLabel(
  status: string,
  t: ReturnType<typeof useTranslations<'providerOperations'>>,
): string {
  const key = status.startsWith('cancelled_') ? 'cancelled' : status;
  const known = new Set([
    'unpaid',
    'pending',
    'paid',
    'held_escrow',
    'released',
    'refunded',
    'awaiting_approval',
    'declined',
    'cancelled',
  ]);
  return known.has(key) ? t(`status.${key}` as never) : status;
}
