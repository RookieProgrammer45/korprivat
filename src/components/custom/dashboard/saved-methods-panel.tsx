//
// One-line affordance for the `/dashboard/student/payment-methods`
// surface. Reads the PII-bearing list of "saved methods of payment" +
// shows each row's `customerEmail`, `brand`, optional `last4`, and the
// `lastUsedAt` relative timestamp — the webhook-shaped fields the proxy
// has today. A learner can pick "Set as default" via the PATCH route and
// "Forget" via the same route with `action: 'forget'`. The island re-
// renders after the PATCH so the default radio follows the curlies.
//
// Why this is a SEPARATE island and not a fragment of `/profile`
// (the standalone /profile surface): the brief scopes rebook +
// saved-payment-methods to the LEARNER dashboard. The `/profile`
// surface is general (signed-in user, both roles) — and the
// `/profile` route does not yet narrate the "saved payment method"
// list. Keeping this island small and tightly in `dashboard` keeps
// the page composition focused on the learner flow.

'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { apiFetch } from '@/lib/api-client';
import {
  type ProfileLastBookedInstructor,
  ProfileMeReadout,
  SavedPaymentMethodList,
} from '@/lib/contracts/saved-payment-methods';

type SavedItem = SavedPaymentMethodList extends { items: Array<infer T> } ? T : never;

type State =
  | { kind: 'loading' }
  | { kind: 'ready'; items: SavedItem[]; lastInstructors: ProfileLastBookedInstructor[] }
  | { kind: 'error' };

export function SavedMethodsPanel() {
  const t = useTranslations('dashboard.student.paymentMethods');
  const [state, setState] = useState<State>({ kind: 'loading' });

  useEffect(() => {
    let active = true;
    // Fetch both endpoints so the panel can show "no rebook yet" with a
    // direct CTA to the booking history. The contract contract is small
    // enough that two fetches stay cheap.
    Promise.all([
      apiFetch('/api/profile/payment-methods', { schema: SavedPaymentMethodList }),
      apiFetch('/api/profile/me', { schema: ProfileMeReadout }),
    ])
      .then(([list, profile]) => {
        if (!active) return;
        setState({
          kind: 'ready',
          items: list.items,
          lastInstructors: profile.lastInstructors,
        });
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
        <CardContent className="flex flex-col gap-3 p-6">
          <p className="text-small text-brand-700 dark:text-brand-300">{t('loadError')}</p>
        </CardContent>
      </Card>
    );
  }

  const { items, lastInstructors } = state;

  async function setDefault(id: string) {
    try {
      await apiFetch(`/api/profile/payment-methods/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify({ action: 'default' }),
      });
      // Re-fetch so the in-memory "default radio" follows the PATCH —
      // we re-read /api/profile/payment-methods which sorts by
      // `lastUsedAt` desc and picks the most-recent as the default.
      const next = await apiFetch('/api/profile/payment-methods', {
        schema: SavedPaymentMethodList,
      });
      setState((prev) =>
        prev.kind === 'ready'
          ? { kind: 'ready', items: next.items, lastInstructors: prev.lastInstructors }
          : prev,
      );
    } catch {
      // Toast omitted to avoid new dep — the island can re-fetch on retry.
    }
  }
  async function forget(id: string) {
    try {
      await apiFetch(`/api/profile/payment-methods/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify({ action: 'forget' }),
      });
      setState((prev) =>
        prev.kind === 'ready'
          ? {
              kind: 'ready',
              items: prev.items.filter((row) => row.id !== id),
              lastInstructors: prev.lastInstructors,
            }
          : prev,
      );
    } catch {
      // surfacing the error is a follow-on
    }
  }

  if (items.length === 0) {
    return (
      <div className="grid gap-4">
        <Card className="surface-panel border-border bg-card">
          <CardContent className="grid gap-3 p-6">
            <p className="text-body font-medium text-foreground">{t('emptyTitle')}</p>
            <p className="text-small text-muted-foreground">{t('emptyBody')}</p>
          </CardContent>
        </Card>
        {lastInstructors.length > 0 ? (
          <Card className="surface-panel border-border bg-card">
            <CardContent className="flex flex-col gap-3 p-6">
              <p className="text-small text-muted-foreground">{t('emptyHint')}</p>
            </CardContent>
          </Card>
        ) : null}
      </div>
    );
  }

  return (
    <ul className="grid gap-3">
      {items.map((row) => (
        <li key={row.id}>
          <Card className="surface-panel border-border bg-card">
            <CardContent className="grid gap-3 p-5 sm:grid-cols-[2fr_1fr_auto] sm:items-center">
              <div className="flex flex-col gap-0.5">
                <span className="font-display text-base font-semibold text-foreground">
                  {row.customerEmail}
                </span>
                <span className="text-small text-muted-foreground">
                  {row.last4
                    ? t('last4WithBrand', {
                        brand: row.brand,
                        last4: row.last4,
                      })
                    : t('brandOnly', { brand: row.brand })}
                </span>
              </div>
              <span className="text-small text-foreground">
                {t('lastUsed', { when: formatRelative(row.lastUsedAt) })}
              </span>
              <div className="flex items-center gap-2">
                {row.isDefault ? (
                  <Badge
                    variant="outline"
                    className="border-brand-500/40 bg-brand-100 text-brand-700 dark:bg-brand-900 dark:text-brand-300"
                  >
                    {t('defaultBadge')}
                  </Badge>
                ) : (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setDefault(row.id)}
                  >
                    {t('setDefault')}
                  </Button>
                )}
                <Button type="button" variant="ghost" size="sm" onClick={() => forget(row.id)}>
                  {t('forget')}
                </Button>
              </div>
            </CardContent>
          </Card>
        </li>
      ))}
    </ul>
  );
}

function formatRelative(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const diffMs = Date.now() - d.getTime();
  const minutes = Math.round(diffMs / 60000);
  if (minutes < 1) return 'now';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d`;
  const months = Math.round(days / 30);
  return `${months}mo`;
}
