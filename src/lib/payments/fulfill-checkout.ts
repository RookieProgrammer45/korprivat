// Mark a booking paid from a completed Stripe Checkout Session.
// Webhook and payment-poll share this CAS; a cancellation loser is deliberately
// distinct from a harmless duplicate so its capture is reconciled/refunded.

import 'server-only';
import { generateLearnerAccessToken } from '@/lib/business/booking-access';
import { generateBookingToken } from '@/lib/business/escrow';
import { prisma } from '@/lib/db';

const TERMINAL_PAYMENT_STATES = ['held_escrow', 'released', 'refunded'] as const;
const CANCEL_TERMINAL_STATES = [
  'cancelled_early',
  'cancelled_late',
  'cancelled_full_refund',
  'cancelled_partial',
] as const;

export type CancelledCheckoutBooking = {
  id: string;
  paymentStatus: string | null;
  cancellationOutcome: string | null;
  cancellationPolicyTier: string | null;
  grossChargedSek: number | null;
  paidAt: Date | null;
  heldAt: Date | null;
  stripeSessionId: string | null;
  stripeCheckoutSessionId: string | null;
};

export type MarkBookingPaidResult =
  | {
      ok: true;
      kind: 'paid';
      actionToken: string;
      learnerAccessToken: string | null;
    }
  | { ok: true; kind: 'duplicate' }
  | { ok: true; kind: 'cancelled'; booking: CancelledCheckoutBooking }
  | { ok: true; kind: 'ignored' };

function isCancelledBooking(row: {
  paymentStatus: string | null;
  cancellationOutcome: string | null;
}): boolean {
  return (
    row.cancellationOutcome != null ||
    CANCEL_TERMINAL_STATES.includes(row.paymentStatus as (typeof CANCEL_TERMINAL_STATES)[number])
  );
}

async function cancellationSnapshot(bookingId: string): Promise<CancelledCheckoutBooking | null> {
  return prisma.booking.findUnique({
    where: { id: bookingId },
    select: {
      id: true,
      paymentStatus: true,
      cancellationOutcome: true,
      cancellationPolicyTier: true,
      grossChargedSek: true,
      paidAt: true,
      heldAt: true,
      stripeSessionId: true,
      stripeCheckoutSessionId: true,
    },
  });
}

export async function markBookingPaidFromCheckout(input: {
  bookingId: string;
  stripeSessionId: string;
  /** When true, do not rotate learnerAccessTokenHash (caller already holds a valid token). */
  preserveLearnerToken?: boolean;
}): Promise<MarkBookingPaidResult> {
  const booking = await cancellationSnapshot(input.bookingId);

  if (!booking) {
    return { ok: true, kind: 'ignored' };
  }
  if (isCancelledBooking(booking)) {
    return { ok: true, kind: 'cancelled', booking };
  }
  if (booking.paidAt != null) {
    return { ok: true, kind: 'duplicate' };
  }

  const actionToken = generateBookingToken();
  const learnerAccess = input.preserveLearnerToken ? null : generateLearnerAccessToken();
  const paidAt = new Date();

  const updateResult = await prisma.booking.updateMany({
    where: {
      id: input.bookingId,
      paidAt: null,
      cancellationOutcome: null,
      paymentStatus: {
        notIn: [...TERMINAL_PAYMENT_STATES, ...CANCEL_TERMINAL_STATES],
      },
    },
    data: {
      paidAt,
      stripeSessionId: input.stripeSessionId,
      stripeCheckoutSessionId: input.stripeSessionId,
      paymentStatus: 'held_escrow',
      heldAt: paidAt,
      actionToken,
      ...(learnerAccess ? { learnerAccessTokenHash: learnerAccess.tokenHash } : {}),
    },
  });

  if (updateResult.count === 0) {
    // Re-read after the failed CAS. This distinguishes a concurrent payment
    // winner from the cancellation that must receive a compensating refund.
    const fresh = await cancellationSnapshot(input.bookingId);
    if (!fresh) return { ok: true, kind: 'ignored' };
    if (isCancelledBooking(fresh)) return { ok: true, kind: 'cancelled', booking: fresh };
    return { ok: true, kind: 'duplicate' };
  }

  return {
    ok: true,
    kind: 'paid',
    actionToken,
    learnerAccessToken: learnerAccess?.token ?? null,
  };
}

export async function isBookingAlreadyPaid(bookingId: string): Promise<boolean> {
  const row = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: { paidAt: true, paymentStatus: true },
  });
  if (!row) return false;
  if (row.paidAt) return true;
  return (
    row.paymentStatus === 'held_escrow' ||
    row.paymentStatus === 'released' ||
    row.paymentStatus === 'paid' ||
    row.paymentStatus === 'refunded'
  );
}
