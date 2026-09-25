// @polsia:user-owned — student dashboard island.
//
// Loads /api/bookings/me via the api-fetch + zod contract path so the
// response shape is validated at the client. Empty / loading / error
// guards per the data-plane pattern (see @/components/custom/booking-form
// for the canonical example).

'use client';

import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { apiFetch } from '@/lib/api-client';
import { BookingList } from '@/lib/contracts/auth';
import type { BookingPaymentStatus } from '@/lib/contracts/bookings';

export function StudentDashboard() {
  const t = useTranslations('dashboard.student');
  const locale = useLocale();
  const [state, setState] = useState<
    | { kind: 'loading' }
    | { kind: 'ready'; items: ReturnType<typeof BookingList.parse>['items'] }
    | { kind: 'error' }
  >({ kind: 'loading' });

  useEffect(() => {
    let active = true;
    apiFetch('/api/bookings/me', { schema: BookingList })
      .then((data) => {
        if (!active) return;
        setState({ kind: 'ready', items: data.items });
      })
      .catch(() => {
        if (!active) return;
        setState({ kind: 'error' });
      });
    return () => {
      active = false;
    };
  }, []);

  if (state.kind === 'loading') {
    return <Skeleton className="h-32 w-full rounded-lg" />;
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
            onClick={() => window.location.reload()}
            className="border-brand-500/40"
          >
            {t('retry')}
          </Button>
        </CardContent>
      </Card>
    );
  }
  if (state.items.length === 0) {
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
    <div className="grid gap-3">
      <div className="flex items-center justify-between">
        <p className="text-eyebrow text-muted-foreground">{t('upcomingBookings')}</p>
        <div className="flex items-center gap-3">
          <p className="text-caption font-medium uppercase tracking-[0.12em] text-muted-foreground">
            {t('count', { count: state.items.length })}
          </p>
          <Button asChild variant="ghost" size="sm">
            <Link href="/dashboard/student/bookings">{t('viewAllBookings')}</Link>
          </Button>
        </div>
      </div>
      <ul className="grid gap-3">
        {state.items.map((row) => (
          <li key={row.id}>
            <Card className="surface-card border-border bg-card transition-colors duration-200 hover:border-brand-500/40 hover:shadow-md">
              <CardContent className="grid gap-2 p-5 sm:grid-cols-[2fr_1fr_auto_auto] sm:items-center">
                <div className="flex flex-col gap-0.5">
                  <span className="font-display text-base font-semibold text-foreground">
                    {row.counterpartyName}
                  </span>
                  <span className="text-small text-muted-foreground">{row.category}</span>
                </div>
                <span className="text-small text-foreground">
                  {formatDate(row.preferredAt, locale)}
                </span>
                <PaymentBadge status={row.paymentStatus} t={t} />
                <Button asChild variant="ghost" size="sm" className="justify-self-end">
                  <Link href={`/bookings/${encodeURIComponent(row.id)}`}>{t('open')}</Link>
                </Button>
              </CardContent>
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}

function PaymentBadge({
  status,
  t,
}: {
  status: BookingPaymentStatus;
  t: ReturnType<typeof useTranslations<'dashboard.student'>>;
}) {
  switch (status) {
    case 'unpaid':
      return (
        <Badge
          variant="outline"
          className="border-brand-500/40 bg-brand-100 text-brand-700 dark:bg-brand-900 dark:text-brand-300"
        >
          {t('paymentStatus.unpaid')}
        </Badge>
      );
    case 'pending':
      return (
        <Badge variant="outline" className="border-border bg-muted text-foreground">
          {t('paymentStatus.pending')}
        </Badge>
      );
    case 'paid':
      return (
        <Badge
          variant="outline"
          className="border-brand-500/40 bg-brand-100 text-brand-700 dark:bg-brand-900 dark:text-brand-300"
        >
          {t('paymentStatus.paid')}
        </Badge>
      );
    case 'held_escrow':
      return (
        <Badge
          variant="outline"
          className="border-brand-500/40 bg-brand-100 text-brand-700 dark:bg-brand-900 dark:text-brand-300"
        >
          {t('paymentStatus.heldEscrow')}
        </Badge>
      );
    case 'released':
      return (
        <Badge
          variant="outline"
          className="border-brand-500/40 bg-brand-100 text-brand-700 dark:bg-brand-900 dark:text-brand-300"
        >
          {t('paymentStatus.released')}
        </Badge>
      );
    case 'refunded':
      return (
        <Badge variant="outline" className="border-border bg-muted text-muted-foreground">
          {t('paymentStatus.refunded')}
        </Badge>
      );
    case 'awaiting_approval':
      return (
        <Badge
          variant="outline"
          className="border-brand-500/40 bg-brand-100 text-brand-700 dark:bg-brand-900 dark:text-brand-300"
        >
          {t('paymentStatus.awaitingApproval')}
        </Badge>
      );
    case 'declined':
      return (
        <Badge variant="outline" className="border-border bg-muted text-muted-foreground">
          {t('paymentStatus.declined')}
        </Badge>
      );
    case 'cancelled_early':
    case 'cancelled_late':
    case 'cancelled_full_refund':
    case 'cancelled_partial':
      return (
        <Badge variant="outline" className="border-border bg-muted text-muted-foreground">
          {t('paymentStatus.cancelled')}
        </Badge>
      );
  }
}

function formatDate(iso: string, locale: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return new Intl.DateTimeFormat(locale === 'sv' ? 'sv-SE' : 'en-GB', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: 'Europe/Stockholm',
    }).format(d);
  } catch {
    return iso;
  }
}
