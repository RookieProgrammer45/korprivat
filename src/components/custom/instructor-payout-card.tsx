//
// Replaces the prior subscription CTA. Reads the platform-wide fee
// constants from `/api/booking-fees/config` and renders the per-booking
// commission disclosure for the instructor. The example rate block
// uses `600 SEK` because that's the canonical "lesson at the top end of
// the pilot cohort rate band" the rest of the app uses for example
// copy, with the math inlined so this client island never pulls in the
// server-only currency ceiling helper.
//
// No Stripe call here — per the new model the instructor is paid out
// of escrow when each booking is marked complete, with this card
// explaining the commission that flows through that route. No
// signup-time charge.

'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { apiFetch } from '@/lib/api-client';
import { InstructorFeesConfig } from '@/lib/contracts/booking-fees';

type CardState =
  | { kind: 'loading' }
  | { kind: 'ready'; commissionPercent: number }
  | { kind: 'error' };

// The example rate block uses 600 SEK because that's the canonical
// "high end of the pilot cohort rate band" the rest of the app
// references in example copy. The math here intentionally mirrors
// `learnerTotalSek` / `instructorPayoutSek` from
// `src/lib/business/booking-fees.ts` (which is server-only because it
// imports the SEK→USD ceiling helper) so the example cannot drift from
// what the real bookings will charge on the server. Half-up rounding
// via Math.round matches the helper's rounding for positive inputs.
const EXAMPLE_PRICE_SEK = 600;

function exampleBreakdown(commissionPercent: number) {
  const price = EXAMPLE_PRICE_SEK;
  const commission = Math.round((price * commissionPercent) / 100);
  const payout = price - commission;
  const serviceFee = 0;
  const gross = price + serviceFee;
  return { price, serviceFee, gross, commission, payout };
}

export function InstructorPayoutCard() {
  const t = useTranslations('instructorPayoutCard');
  const [state, setState] = useState<CardState>({ kind: 'loading' });

  const reload = () => {
    setState({ kind: 'loading' });
    apiFetch('/api/booking-fees/config', { schema: InstructorFeesConfig })
      .then((data) => setState({ kind: 'ready', commissionPercent: data.commissionPercent }))
      .catch(() => setState({ kind: 'error' }));
  };

  useEffect(() => {
    let active = true;
    apiFetch('/api/booking-fees/config', { schema: InstructorFeesConfig })
      .then((data) => {
        if (active) setState({ kind: 'ready', commissionPercent: data.commissionPercent });
      })
      .catch(() => {
        if (active) setState({ kind: 'error' });
      });
    return () => {
      active = false;
    };
  }, []);

  if (state.kind === 'loading') {
    return <Skeleton className="h-40 w-full rounded-lg" />;
  }

  if (state.kind === 'error') {
    return (
      <Card className="border-destructive/40 bg-destructive/5">
        <CardContent className="grid gap-2 p-6">
          <p className="text-eyebrow text-destructive">{t('eyebrow')}</p>
          <p className="text-h4 text-foreground">{t('errorTitle')}</p>
          <button
            type="button"
            onClick={reload}
            className="text-body text-brand-700 underline underline-offset-4 dark:text-brand-300"
          >
            {t('retry')}
          </button>
        </CardContent>
      </Card>
    );
  }

  const commissionPercent = state.commissionPercent;
  const example = exampleBreakdown(commissionPercent);
  const payoutPercent = 100 - commissionPercent;

  return (
    <Card className="surface-card border-brand-500/40 bg-brand-100 shadow-sm dark:bg-brand-900">
      <CardContent className="grid gap-5 p-6">
        <header className="grid gap-1">
          <p className="text-eyebrow text-brand-700 dark:text-brand-300">{t('eyebrow')}</p>
          <h2 className="font-display text-h2 leading-tight tracking-tight text-foreground">
            {t('title')}
          </h2>
        </header>

        <p className="text-body-lg text-foreground">{t('body', { percent: commissionPercent })}</p>

        <p className="text-body text-muted-foreground">
          {t('payoutLine', { percent: payoutPercent })}
        </p>

        <div className="grid gap-2 rounded-md border border-border bg-background p-5">
          <p className="text-eyebrow text-muted-foreground">{t('exampleTitle')}</p>
          <p className="text-body-lg text-foreground">
            {t('exampleLine', {
              price: example.price,
              payout: example.payout,
              fee: example.commission,
            })}
          </p>
          <p className="text-small text-muted-foreground">
            {t('exampleLearnerLine', {
              price: example.price,
              fee: example.serviceFee,
              total: example.gross,
            })}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
