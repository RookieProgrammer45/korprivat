//
// Read-only org booking list for school OWNER/STAFF on the school dashboard.

'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { apiFetch } from '@/lib/api-client';
import {
  type SchoolBookingItem,
  SchoolBookingList,
} from '@/lib/contracts/provider-operations';

type Props = { organizationId: string };

export function SchoolBookingsPanel({ organizationId }: Props) {
  const t = useTranslations('dashboardSchool.bookings');
  const locale = useLocale();
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [items, setItems] = useState<SchoolBookingItem[]>([]);

  const load = useCallback(() => {
    setState('loading');
    apiFetch(`/api/orgs/${encodeURIComponent(organizationId)}/bookings?state=all`, {
      schema: SchoolBookingList,
    })
      .then((data) => {
        setItems(data.items);
        setState('ready');
      })
      .catch(() => setState('error'));
  }, [organizationId]);

  useEffect(() => {
    load();
  }, [load]);

  if (state === 'loading') return <Skeleton className="h-48 w-full rounded-xl" />;
  if (state === 'error') {
    return (
      <Card className="border-destructive/30 bg-card">
        <CardContent className="flex items-center justify-between gap-4 p-6">
          <p className="text-small text-muted-foreground">{t('loadError')}</p>
          <Button type="button" variant="outline" size="sm" onClick={load}>
            {t('retry')}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <section id="bookings" className="grid gap-4 scroll-mt-24">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-eyebrow text-muted-foreground">{t('eyebrow')}</p>
          <h2 className="font-display text-h3 tracking-tight">{t('title')}</h2>
          <p className="mt-1 max-w-2xl text-small text-muted-foreground">{t('lead')}</p>
        </div>
        <p className="text-caption uppercase tracking-[0.12em] text-muted-foreground">
          {t('count', { count: items.length })}
        </p>
      </div>
      {items.length === 0 ? (
        <Card className="surface-panel border-border bg-card">
          <CardContent className="grid gap-2 p-6 text-small text-muted-foreground">
            <p className="font-medium text-foreground">{t('empty')}</p>
            <p>{t('emptyBody')}</p>
          </CardContent>
        </Card>
      ) : (
        <ul className="grid gap-3">
          {items.map((item) => (
            <li key={item.id}>
              <Card className="surface-card border-border bg-card">
                <CardContent className="grid gap-3 p-5 sm:grid-cols-[1.2fr_1fr_auto] sm:items-center">
                  <div className="grid gap-0.5">
                    <p className="font-display text-base font-semibold text-foreground">
                      {item.counterpartyName}
                    </p>
                    <p className="text-small text-muted-foreground">
                      {t('withInstructor', { name: item.instructorName })} · {item.category}
                    </p>
                  </div>
                  <p className="text-small text-foreground">
                    {formatDate(item.scheduledAt, locale)}
                  </p>
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <Badge variant="outline">{paymentLabel(item.paymentStatus, t)}</Badge>
                  </div>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function paymentLabel(
  status: string,
  t: ReturnType<typeof useTranslations<'dashboardSchool.bookings'>>,
): string {
  switch (status) {
    case 'awaiting_approval':
      return t('status.awaitingApproval');
    case 'unpaid':
    case 'pending':
    case 'paid':
      return t('status.paymentPending');
    case 'held_escrow':
      return t('status.heldEscrow');
    case 'awaiting_buyer_confirmation':
      return t('status.awaitingConfirm');
    case 'release_ready':
    case 'payout_pending':
      return t('status.payoutPending');
    case 'payout_failed':
      return t('status.payoutFailed');
    case 'released':
      return t('status.released');
    case 'disputed':
      return t('status.disputed');
    case 'refunded':
      return t('status.refunded');
    case 'declined':
      return t('status.declined');
    default:
      if (status.startsWith('cancelled_')) return t('status.cancelled');
      return t('status.other');
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
