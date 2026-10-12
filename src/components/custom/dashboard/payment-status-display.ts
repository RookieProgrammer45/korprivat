import type { BookingPaymentStatus } from '@/lib/contracts/bookings';

export type PaymentStatusLabelKey =
  | 'unpaid'
  | 'pending'
  | 'paid'
  | 'heldEscrow'
  | 'awaitingBuyerConfirmation'
  | 'releaseReady'
  | 'payoutFailed'
  | 'released'
  | 'disputed'
  | 'refunded'
  | 'cancelled'
  | 'awaitingApproval'
  | 'declined';

export type PaymentStatusTone = 'accent' | 'neutral' | 'muted' | 'destructive';

export type PaymentStatusDisplay = {
  labelKey: PaymentStatusLabelKey;
  tone: PaymentStatusTone;
};

const PAYMENT_STATUS_DISPLAYS: Record<BookingPaymentStatus, PaymentStatusDisplay> = {
  unpaid: { labelKey: 'unpaid', tone: 'accent' },
  pending: { labelKey: 'pending', tone: 'neutral' },
  paid: { labelKey: 'paid', tone: 'accent' },
  held_escrow: { labelKey: 'heldEscrow', tone: 'accent' },
  awaiting_buyer_confirmation: { labelKey: 'awaitingBuyerConfirmation', tone: 'accent' },
  release_ready: { labelKey: 'releaseReady', tone: 'neutral' },
  released: { labelKey: 'released', tone: 'accent' },
  disputed: { labelKey: 'disputed', tone: 'muted' },
  payout_pending: { labelKey: 'releaseReady', tone: 'neutral' },
  payout_failed: { labelKey: 'payoutFailed', tone: 'destructive' },
  refunded: { labelKey: 'refunded', tone: 'muted' },
  cancelled_early: { labelKey: 'cancelled', tone: 'muted' },
  cancelled_late: { labelKey: 'cancelled', tone: 'muted' },
  cancelled_full_refund: { labelKey: 'cancelled', tone: 'muted' },
  cancelled_partial: { labelKey: 'cancelled', tone: 'muted' },
  awaiting_approval: { labelKey: 'awaitingApproval', tone: 'accent' },
  declined: { labelKey: 'declined', tone: 'muted' },
};

const UNKNOWN_PAYMENT_STATUS_DISPLAY: PaymentStatusDisplay = {
  labelKey: 'pending',
  tone: 'neutral',
};

export function paymentStatusDisplay(status: string): PaymentStatusDisplay {
  return PAYMENT_STATUS_DISPLAYS[status as BookingPaymentStatus] ?? UNKNOWN_PAYMENT_STATUS_DISPLAY;
}

export function paymentStatusBadgeClassName(tone: PaymentStatusTone): string {
  switch (tone) {
    case 'accent':
      return 'border-brand-500/40 bg-brand-100 text-brand-700 dark:bg-brand-900 dark:text-brand-300';
    case 'destructive':
      return 'border-destructive/40 text-destructive';
    case 'muted':
      return 'border-border bg-muted text-muted-foreground';
    case 'neutral':
      return 'border-border bg-muted text-foreground';
  }
}
