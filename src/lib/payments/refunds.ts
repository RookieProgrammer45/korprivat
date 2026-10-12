// Stripe refunds for cancelled bookings. Stripe calls are intentionally outside
// database transactions; stable idempotency keys make retrying a failed
// reconciliation safe.

import 'server-only';
import type Stripe from 'stripe';
import {
  cancellationRefundAmountSek,
  computeCancellationFeeSek,
  getPolicyForTier,
} from '@/lib/business/cancellation-policy';
import { prisma } from '@/lib/db';
import { sendEmail } from '@/lib/email/send';
import { notificationEmail } from '@/lib/email/templates';
import { OWNER_EMAIL } from '@/lib/ownership';
import { validateBookingCheckoutAmount } from '@/lib/payments/checkout-amount';
import { getStripe } from '@/lib/payments/stripe';

export type RefundResult =
  | { kind: 'refunded'; refundId: string; amountSek: number | null }
  | { kind: 'pending'; refundId: string; amountSek: number | null }
  | { kind: 'duplicate'; refundId: string }
  | {
      kind: 'skipped';
      reason:
        | 'no_session'
        | 'no_payment_intent'
        | 'already_refunded'
        | 'missing_booking'
        | 'zero_amount'
        | 'not_captured';
    }
  | { kind: 'error'; message: string };

function alertRecipient(): string {
  return (
    process.env.EMAIL_OVERRIDE_TO?.trim() ||
    process.env.CONTACT_EMAIL?.trim() ||
    process.env.OWNER_EMAIL?.trim() ||
    OWNER_EMAIL
  );
}

async function alertOps(subject: string, lines: string[]) {
  console.error(`[refunds] ${subject}`, { lines });
  try {
    const mail = notificationEmail({
      subject: `[DriveLinkUp] ${subject}`,
      title: subject,
      lines,
    });
    await sendEmail({ to: alertRecipient(), ...mail });
  } catch (err) {
    console.error('[refunds] alert email failed', err);
  }
}

function paymentIntentId(session: Pick<Stripe.Checkout.Session, 'payment_intent'>): string | null {
  return typeof session.payment_intent === 'string'
    ? session.payment_intent
    : (session.payment_intent?.id ?? null);
}

function refundIdempotencyKey(bookingId: string, amountSek: number | undefined): string {
  return `refund:booking:${bookingId}:${amountSek == null ? 'full' : `sek-${amountSek}`}`;
}

async function sendRefundNoticeOnce(input: {
  booking: {
    locale: string | null;
    studentName: string;
    studentEmail: string;
    grossChargedSek: number | null;
  };
  bookingId: string;
  amountSek: number | undefined;
}) {
  try {
    const locale = input.booking.locale === 'en' ? 'en' : 'sv';
    const { refundNotificationEmail } = await import('@/lib/email/refund-notification');
    const mail = refundNotificationEmail({
      locale,
      recipientName: input.booking.studentName,
      amountSek: input.amountSek ?? input.booking.grossChargedSek ?? null,
      bookingId: input.bookingId,
    });
    await sendEmail({ to: input.booking.studentEmail, ...mail });
  } catch (err) {
    console.error('[refunds] refund notification email failed', err);
  }
}

async function refundPaymentIntent(input: {
  booking: {
    id: string;
    locale: string | null;
    studentName: string;
    studentEmail: string;
    grossChargedSek: number | null;
  };
  paymentIntent: string;
  amountSek?: number;
}): Promise<RefundResult> {
  if (input.amountSek != null && input.amountSek <= 0) {
    return { kind: 'skipped', reason: 'zero_amount' };
  }

  try {
    const requestedRefund = await getStripe().refunds.create(
      {
        payment_intent: input.paymentIntent,
        ...(input.amountSek != null ? { amount: input.amountSek * 100 } : {}),
        metadata: { bookingId: input.booking.id },
      },
      { idempotencyKey: refundIdempotencyKey(input.booking.id, input.amountSek) },
    );

    // Idempotency-key replays can return Stripe's original, stale create
    // response. Retrieve the refund by ID so settlement is based only on its
    // current provider status, including after a prior pending response.
    const refund = await getStripe().refunds.retrieve(requestedRefund.id);
    const amountSek = input.amountSek ?? input.booking.grossChargedSek ?? null;

    if (refund.status === 'pending' || refund.status === 'requires_action') {
      return { kind: 'pending', refundId: refund.id, amountSek };
    }

    if (refund.status === 'failed' || refund.status === 'canceled') {
      const message = `refund_${refund.status}`;
      console.error('[refunds] provider refund did not succeed', {
        bookingId: input.booking.id,
        refundId: refund.id,
        status: refund.status,
      });
      await alertOps('Refund needs review', [
        `Booking ${input.booking.id}: Stripe refund ${refund.id} is ${refund.status}.`,
        'The booking remains retryable with its stable refund idempotency key.',
      ]);
      return { kind: 'error', message };
    }

    if (refund.status !== 'succeeded') {
      const message = `refund_status_${refund.status ?? 'unknown'}`;
      console.error('[refunds] provider refund status is not confirmed', {
        bookingId: input.booking.id,
        refundId: refund.id,
        status: refund.status,
      });
      await alertOps('Refund needs review', [
        `Booking ${input.booking.id}: Stripe refund ${refund.id} has unconfirmed status ${refund.status ?? 'unknown'}.`,
      ]);
      return { kind: 'error', message };
    }

    // Stripe is the financial source of truth. Only a confirmed succeeded
    // refund can settle the booking. A DB failure remains safely retryable with
    // the same Stripe key; updateMany suppresses duplicate notification emails.
    const marked = await prisma.booking.updateMany({
      where: { id: input.booking.id, refundedAt: null },
      data: { refundedAt: new Date() },
    });
    if (marked.count === 1) {
      await sendRefundNoticeOnce({
        booking: input.booking,
        bookingId: input.booking.id,
        amountSek: input.amountSek,
      });
      return {
        kind: 'refunded',
        refundId: refund.id,
        amountSek,
      };
    }
    return { kind: 'duplicate', refundId: refund.id };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'refund_failed';
    if (message.includes('already been refunded') || message.includes('charge_already_refunded')) {
      await prisma.booking.updateMany({
        where: { id: input.booking.id, refundedAt: null },
        data: { refundedAt: new Date() },
      });
      return { kind: 'duplicate', refundId: 'existing' };
    }
    console.error('[refunds] refund failed', { bookingId: input.booking.id, message });
    await alertOps('Refund failed', [
      `Booking ${input.booking.id}: Stripe refund failed.`,
      message,
    ]);
    return { kind: 'error', message };
  }
}

export async function refundBooking(
  bookingId: string,
  opts?: { amountSek?: number | null },
): Promise<RefundResult> {
  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking) return { kind: 'skipped', reason: 'missing_booking' };
  if (booking.refundedAt) return { kind: 'skipped', reason: 'already_refunded' };
  if (opts?.amountSek != null && opts.amountSek <= 0) {
    return { kind: 'skipped', reason: 'zero_amount' };
  }

  const sessionId = booking.stripeSessionId ?? booking.stripeCheckoutSessionId;
  if (!sessionId) return { kind: 'skipped', reason: 'no_session' };

  try {
    const session = await getStripe().checkout.sessions.retrieve(sessionId);
    const paymentIntent = paymentIntentId(session);
    if (!paymentIntent) {
      await alertOps('Refund skipped — no payment_intent', [
        `Booking ${bookingId}: Checkout session ${sessionId} has no payment_intent.`,
      ]);
      return { kind: 'skipped', reason: 'no_payment_intent' };
    }
    return refundPaymentIntent({
      booking,
      paymentIntent,
      ...(opts?.amountSek != null ? { amountSek: opts.amountSek } : {}),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'refund_failed';
    console.error('[refunds] refund reconciliation lookup failed', { bookingId, message });
    await alertOps('Refund failed', [
      `Booking ${bookingId}: Stripe session retrieval failed.`,
      message,
    ]);
    return { kind: 'error', message };
  }
}

/**
 * Reconcile a Checkout Session that captured after a cancellation terminal
 * transition. A cancellation that occurred while the row was merely pending
 * always refunds in full: no card capture existed when its fee was decided.
 */
export async function reconcileCancelledCheckoutCapture(input: {
  bookingId: string;
  sessionId: string;
  cancellationOutcome: string | null;
  cancellationPolicyTier: string | null;
  grossChargedSek: number | null;
  /** Pending/unpaid cancellation: never retain a fee from a later capture. */
  forceFullRefund?: boolean;
  session?: Stripe.Checkout.Session;
}): Promise<RefundResult> {
  const booking = await prisma.booking.findUnique({ where: { id: input.bookingId } });
  if (!booking) return { kind: 'skipped', reason: 'missing_booking' };
  if (booking.refundedAt) return { kind: 'skipped', reason: 'already_refunded' };

  let session = input.session;
  try {
    session ??= await getStripe().checkout.sessions.retrieve(input.sessionId);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'checkout_session_retrieve_failed';
    return { kind: 'error', message };
  }
  if (session.payment_status !== 'paid') return { kind: 'skipped', reason: 'not_captured' };

  const paymentIntent = paymentIntentId(session);
  if (!paymentIntent) {
    await alertOps('Captured cancellation needs reconciliation', [
      `Booking ${input.bookingId}: paid Checkout Session ${input.sessionId} has no payment_intent.`,
    ]);
    return { kind: 'skipped', reason: 'no_payment_intent' };
  }

  const validation = validateBookingCheckoutAmount({
    currency: session.currency,
    amountTotal: session.amount_total,
    grossChargedSek: input.grossChargedSek,
  });

  // A mismatch must never become an escrow payment or receipt. The booking is
  // already cancelled, so a full idempotent refund is the safe reconciliation
  // rather than retaining a fee calculated from an untrusted total.
  if (!validation.ok) {
    return refundPaymentIntent({ booking, paymentIntent });
  }

  let refundAmountSek: number | undefined;
  if (!input.forceFullRefund && input.cancellationOutcome !== 'cancelled_full_refund') {
    const feePercent =
      input.cancellationOutcome === 'cancelled_late'
        ? 100
        : input.cancellationOutcome === 'cancelled_partial'
          ? getPolicyForTier(input.cancellationPolicyTier).partialFeePercent
          : 0;
    const feeSek = computeCancellationFeeSek(validation.amountSek, feePercent);
    const calculatedRefund = cancellationRefundAmountSek(validation.amountSek, feePercent);
    refundAmountSek = calculatedRefund > 0 ? calculatedRefund : undefined;
    // A 100% retained fee has no Stripe refund to issue; it remains an auditable
    // cancelled charge rather than incorrectly calling a zero-value refund.
    if (feeSek >= validation.amountSek && calculatedRefund === 0) {
      return { kind: 'skipped', reason: 'zero_amount' };
    }
  }

  return refundPaymentIntent({
    booking,
    paymentIntent,
    ...(refundAmountSek != null ? { amountSek: refundAmountSek } : {}),
  });
}

/** Ops alert when a released booking is cancelled — transfer already sent. */
export async function alertReleasedCancelNeedsReview(bookingId: string): Promise<void> {
  await alertOps('Cancellation needs review — funds already released', [
    `Booking ${bookingId} was cancelled after payout release.`,
    'Manual Stripe reverse transfer / support review required.',
  ]);
}
