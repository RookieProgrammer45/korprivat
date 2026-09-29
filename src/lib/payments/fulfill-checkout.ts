// Mark a booking paid from a completed Stripe Checkout Session.
// Idempotent on `paidAt IS NULL` — webhook and payment-poll both call this.

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

export type MarkBookingPaidResult =
  | {
      ok: true;
      kind: 'paid';
      actionToken: string;
      learnerAccessToken: string | null;
    }
  | { ok: true; kind: 'duplicate' }
  | { ok: true; kind: 'ignored' };

export async function markBookingPaidFromCheckout(input: {
  bookingId: string;
  stripeSessionId: string;
  /** When true, do not rotate learnerAccessTokenHash (caller already holds a valid token). */
  preserveLearnerToken?: boolean;
}): Promise<MarkBookingPaidResult> {
  const booking = await prisma.booking.findUnique({
    where: { id: input.bookingId },
    select: { id: true, paidAt: true },
  });

  if (!booking) {
    return { ok: true, kind: 'ignored' };
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
    // Lost a race with another writer (webhook retry / payment-poll) — treat as duplicate.
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
