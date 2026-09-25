// @polsia:user-owned — learner-facing fee quote island.
//
// The browser never calculates the service fee. It requests the quote from
// the server, or displays the already-snapshotted values returned by a
// booking. The same component is used on the profile, booking form, and
// payment confirmation surfaces so the vocabulary stays consistent.

'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { apiFetch } from '@/lib/api-client';
import { BookingFeeQuote } from '@/lib/contracts/booking-fees';

type QuoteSnapshot = Pick<BookingFeeQuote, 'priceAmountSek' | 'serviceFeeSek' | 'grossChargedSek'>;

type QuoteState = {
  quote: BookingFeeQuote | null;
  loading: boolean;
  error: boolean;
};

export function BookingPriceSummary({
  instructorId,
  snapshot,
}: {
  instructorId: string;
  snapshot?: QuoteSnapshot | null;
}) {
  const tr = useTranslations('bookingFees.learnerBreakdown');
  const locale = useLocale();
  const [_retryNonce, setRetryNonce] = useState(0);
  const [state, setState] = useState<QuoteState>({
    quote: null,
    loading: true,
    error: false,
  });
  const snapshotPrice = snapshot?.priceAmountSek ?? null;
  const snapshotFee = snapshot?.serviceFeeSek ?? null;
  const snapshotTotal = snapshot?.grossChargedSek ?? null;

  useEffect(() => {
    if (snapshotPrice !== null && snapshotFee !== null && snapshotTotal !== null) {
      setState({
        quote: {
          priceAmountSek: snapshotPrice,
          serviceFeeSek: snapshotFee,
          grossChargedSek: snapshotTotal,
        },
        loading: false,
        error: false,
      });
      return;
    }

    let active = true;
    setState({ quote: null, loading: true, error: false });
    const query = new URLSearchParams({ instructorId });
    apiFetch(`/api/booking-fees/quote?${query.toString()}`, { schema: BookingFeeQuote })
      .then((quote) => {
        if (active) setState({ quote, loading: false, error: false });
      })
      .catch(() => {
        if (active) setState({ quote: null, loading: false, error: true });
      });
    return () => {
      active = false;
    };
  }, [instructorId, snapshotFee, snapshotPrice, snapshotTotal]);

  if (state.loading) {
    return (
      <Card className="booking-summary surface-panel border-border bg-muted">
        <CardContent className="grid gap-3 p-4">
          <Skeleton className="h-3 w-1/3" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-5 w-2/3" />
        </CardContent>
      </Card>
    );
  }

  if (state.error || !state.quote) {
    return (
      <Card className="booking-summary border-destructive/30 bg-destructive/5">
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
          <p className="text-small text-destructive">{tr('error')}</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setRetryNonce((n) => n + 1)}
          >
            {tr('retry')}
          </Button>
        </CardContent>
      </Card>
    );
  }

  const { quote } = state;
  return (
    <Card className="booking-summary surface-panel border-border bg-muted">
      <CardContent className="grid gap-3 p-4">
        <p className="text-eyebrow text-muted-foreground">{tr('eyebrow')}</p>
        <dl className="grid gap-2 text-small">
          <div className="flex items-center justify-between gap-3">
            <dt className="text-muted-foreground">{tr('priceLine')}</dt>
            <dd className="font-medium text-foreground">
              {formatSek(quote.priceAmountSek, locale)}
            </dd>
          </div>
          {quote.serviceFeeSek > 0 ? (
            <div className="flex items-center justify-between gap-3">
              <dt className="text-muted-foreground">{tr('feeLine')}</dt>
              <dd className="font-medium text-foreground">
                {formatSek(quote.serviceFeeSek, locale)}
              </dd>
            </div>
          ) : null}
          <div className="flex items-center justify-between gap-3 border-t border-border pt-2">
            <dt className="font-medium text-foreground">{tr('totalLine')}</dt>
            <dd className="font-display text-h4 font-semibold tracking-tight text-foreground">
              {formatSek(quote.grossChargedSek, locale)}
            </dd>
          </div>
        </dl>
        <p className="text-caption text-muted-foreground">{tr('note')}</p>
      </CardContent>
    </Card>
  );
}

function formatSek(amount: number, locale: string): string {
  return `${new Intl.NumberFormat(locale === 'sv' ? 'sv-SE' : 'en-GB').format(amount)} SEK`;
}
