//
// After Stripe redirects back with `?session_id=cs_xxx`, this island polls
// GET /api/checkout?session_id= to confirm paidAt. Once verified it
// surfaces a localized confirmation; on timeout it shows a localised error
// state with a CTA back to the dashboard.

'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { apiFetch } from '@/lib/api-client';

const checkoutStatusSchema = z.object({
  verified: z.boolean(),
  paymentStatus: z.string().nullable().optional(),
  bookingId: z.string().optional(),
});

type State =
  | { kind: 'missing-session' }
  | { kind: 'loading' }
  | { kind: 'verified' }
  | { kind: 'timeout' };

const MAX_POLLS = 8;
const POLL_DELAY_MS = 750;

export function CheckoutSuccessIsland({
  dashboardHref = '/dashboard',
  bookingsHref,
}: {
  dashboardHref?: string;
  bookingsHref?: string;
}) {
  const t = useTranslations('checkout.success');
  const params = useSearchParams();
  const sessionId = params.get('session_id')?.trim() ?? '';
  const [state, setState] = useState<State>(
    sessionId ? { kind: 'loading' } : { kind: 'missing-session' },
  );
  const attemptsRef = useRef(0);

  useEffect(() => {
    if (!sessionId) return;

    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    const poll = async () => {
      if (cancelled) return;
      attemptsRef.current += 1;
      try {
        const result = await apiFetch(
          `/api/checkout?${new URLSearchParams({
            session_id: sessionId,
          }).toString()}`,
          { schema: checkoutStatusSchema },
        );
        if (cancelled) return;
        if (result.verified) {
          setState({ kind: 'verified' });
          return;
        }
      } catch {
        // Treat verify failures as "not yet verified" — keep polling within
        // the budget, then degrade to the timeout state.
      }
      if (attemptsRef.current >= MAX_POLLS) {
        if (!cancelled) setState({ kind: 'timeout' });
        return;
      }
      timeoutId = setTimeout(poll, POLL_DELAY_MS);
    };

    poll();
    return () => {
      cancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [sessionId]);

  if (state.kind === 'missing-session') {
    return (
      <section className="mx-auto grid max-w-xl gap-4 rounded-lg border border-destructive/40 bg-destructive/5 p-8 text-center shadow-sm">
        <p className="text-eyebrow text-destructive">{t('eyebrow')}</p>
        <h1 className="font-display text-h2 leading-tight tracking-tight text-foreground">
          {t('missingTitle')}
        </h1>
        <p className="text-body text-muted-foreground">{t('missingBody')}</p>
        <div className="mt-2 flex justify-center">
          <Button asChild>
            <Link href={dashboardHref}>{t('cta')}</Link>
          </Button>
        </div>
      </section>
    );
  }

  if (state.kind === 'loading') {
    return (
      <section className="mx-auto grid max-w-xl gap-4 rounded-lg border border-border bg-card p-8 text-center shadow-sm">
        <Skeleton className="mx-auto h-4 w-24" />
        <Skeleton className="mx-auto h-7 w-64" />
        <Skeleton className="mx-auto h-4 w-80" />
      </section>
    );
  }

  if (state.kind === 'verified') {
    return (
      <section className="mx-auto grid max-w-xl gap-4 rounded-lg border border-brand-500/40 bg-brand-100 p-8 text-center shadow-sm dark:bg-brand-900">
        <p className="text-eyebrow text-brand-700 dark:text-brand-300">{t('eyebrow')}</p>
        <h1 className="font-display text-h2 leading-tight tracking-tight text-foreground">
          {t('verifiedTitle')}
        </h1>
        <p className="text-body text-muted-foreground">{t('verifiedBody')}</p>
        <div className="mt-2 flex flex-wrap justify-center gap-3">
          {bookingsHref ? (
            <Button asChild>
              <Link href={bookingsHref}>{t('bookingsCta')}</Link>
            </Button>
          ) : null}
          <Button asChild variant={bookingsHref ? 'outline' : 'default'}>
            <Link href={dashboardHref}>{t('cta')}</Link>
          </Button>
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto grid max-w-xl gap-4 rounded-lg border border-border bg-card p-8 text-center shadow-sm">
      <p className="text-eyebrow text-muted-foreground">{t('eyebrow')}</p>
      <h1 className="font-display text-h2 leading-tight tracking-tight text-foreground">
        {t('timeoutTitle')}
      </h1>
      <p className="text-body text-muted-foreground">{t('timeoutBody')}</p>
      <div className="mt-2 flex justify-center">
        <Button asChild>
          <Link href={dashboardHref}>{t('cta')}</Link>
        </Button>
      </div>
    </section>
  );
}
