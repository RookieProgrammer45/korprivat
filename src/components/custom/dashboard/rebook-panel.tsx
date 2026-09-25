// @polsia:user-owned — `<RebookPanel/>` island.
//
// One-line affordance that the dashboard's "Booking history" page
// mounts ABOVE the history list. Renders the user's most-recent
// distinct instructors (read from `/api/profile/me`'s `lastInstructors`)
// as compact cards, each with a "Rebook" CTA that deep-links to
// `/instructors/[id]?rebook=<bookingId>` so the rebook form prefills.
//
// Why a LEFT-ALIGNED rail that ships on the same screen as the rest of
// the history: the marketplace rebook pattern relies on the
// learner recognising an instructor they already used, so the panel is
// visually adjacent to the history (the same row, the same key) —
// clicking on the matching row in the history below this card
// surfaces the same booking numbers from the `lastBookingId`.
//
// Behaviour:
//   - The `?rebook=<bookingId>` deep-link on `/instructors/[id]` is
//     decoded and pre-fills the booking form. The page itself is the
//     `BookingForm` island we already have; the rebook card on the
//     history page just slots the parameter on its <Link>'s href.
//   - We DO NOT issue the "rebook" request from this island — that
//     would be a server-side mutation. The rebook flow is one tap on
//     the card → `/instructors/[id]?rebook=<bookingId>` → form
//     pre-fill → "Pay for the lesson".

'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { apiFetch } from '@/lib/api-client';
import { ProfileMeReadout } from '@/lib/contracts/saved-payment-methods';

type State =
  | { kind: 'loading' }
  | { kind: 'ready'; items: ProfileMeReadout['lastInstructors'] }
  | { kind: 'error' }
  | { kind: 'empty' };

export function RebookPanel() {
  const t = useTranslations('dashboard.student.rebook');
  const [state, setState] = useState<State>({ kind: 'loading' });

  useEffect(() => {
    let active = true;
    apiFetch('/api/profile/me', { schema: ProfileMeReadout })
      .then((data) => {
        if (!active) return;
        if (data.lastInstructors.length === 0) {
          // It's possible the learner has zero past bookings AND a
          // signed-in session — in which case we render nothing rather
          // than a "no rebook yet" copy. The page below already has its
          // own empty-state.
          setState({ kind: 'empty' });
          return;
        }
        setState({ kind: 'ready', items: data.lastInstructors });
      })
      .catch(() => {
        if (!active) return;
        setState({ kind: 'error' });
      });
    return () => {
      active = false;
    };
  }, []);

  if (state.kind !== 'ready') return null;

  if (state.items.length === 0) return null;

  return (
    <section className="grid gap-3" aria-label={t('ariaLabel')}>
      <div className="flex items-center justify-between">
        <h2 className="font-display text-h3 leading-tight tracking-tight text-foreground">
          {t('title')}
        </h2>
      </div>
      <p className="text-small text-muted-foreground">{t('lead')}</p>
      <ul className="grid gap-3 sm:grid-cols-2">
        {state.items.map((row) => (
          <li key={row.id}>
            <Card className="border-border bg-card transition-colors duration-200 hover:border-brand-500/40 hover:shadow-md">
              <CardContent className="grid gap-3 p-5">
                <div className="flex flex-col gap-0.5">
                  <span className="font-display text-base font-semibold text-foreground">
                    {row.name}
                  </span>
                  <span className="text-small text-muted-foreground">
                    {row.city ? `${row.city} · ${row.category}` : row.category}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-display font-semibold tabular-nums text-foreground">
                    {formatSek(row.hourlyRateSek)}
                  </span>
                  <Button asChild size="sm">
                    <Link
                      href={`/instructors/${encodeURIComponent(row.id)}?rebook=${encodeURIComponent(row.lastBookingId)}`}
                    >
                      {t('cta', { teacher: row.name.split(' ')[0] ?? row.name })}
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </li>
        ))}
      </ul>
    </section>
  );
}

function formatSek(amountSek: number): string {
  try {
    return new Intl.NumberFormat('sv-SE', {
      style: 'currency',
      currency: 'SEK',
      useGrouping: true,
      maximumFractionDigits: 0,
    }).format(amountSek);
  } catch {
    return `${amountSek} SEK`;
  }
}
