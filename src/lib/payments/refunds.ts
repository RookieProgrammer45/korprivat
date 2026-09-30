// Stripe refunds for cancelled bookings still in held_escrow.
// Resolves PaymentIntent via Checkout Session, then refunds with idempotency.

import 'server-only';
import { prisma } from '@/lib/db';
import { sendEmail } from '@/lib/email/send';
import { notificationEmail } from '@/lib/email/templates';
import { getStripe } from '@/lib/payments/stripe';
import { OWNER_EMAIL } from '@/lib/ownership';

export type RefundResult =
  | { kind: 'refunded'; refundId: string; amountSek: number | null }
  | { kind: 'duplicate'; refundId: string }
  | { kind: 'skipped'; reason: 'no_session' | 'no_payment_intent' | 'already_refunded' | 'missing_booking' | 'zero_amount' }
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

export async function refundBooking(
  bookingId: string,
  opts?: { amountSek?: number | null },
): Promise<RefundResult> {
  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking) {
    return { kind: 'skipped', reason: 'missing_booking' };
  }
  if (booking.refundedAt) {
    return { kind: 'skipped', reason: 'already_refunded' };
  }

  const sessionId = booking.stripeSessionId ?? booking.stripeCheckoutSessionId;
  if (!sessionId) {
    return { kind: 'skipped', reason: 'no_session' };
  }

  if (opts?.amountSek != null && opts.amountSek <= 0) {
    return { kind: 'skipped', reason: 'zero_amount' };
  }

  try {
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    const paymentIntentId =
      typeof session.payment_intent === 'string'
        ? session.payment_intent
        : session.payment_intent?.id;
    if (!paymentIntentId) {
      await alertOps('Refund skipped — no payment_intent', [
        `Booking ${bookingId}: Checkout session ${sessionId} has no payment_intent.`,
      ]);
      return { kind: 'skipped', reason: 'no_payment_intent' };
    }

    const refundParams: {
      payment_intent: string;
      amount?: number;
      metadata: { bookingId: string };
    } = {
      payment_intent: paymentIntentId,
      metadata: { bookingId },
    };
    if (opts?.amountSek != null) {
      refundParams.amount = opts.amountSek * 100;
    }

    const refund = await stripe.refunds.create(refundParams, {
      idempotencyKey: `refund:booking:${bookingId}`,
    });

    await prisma.booking.update({
      where: { id: bookingId },
      data: { refundedAt: new Date() },
    });

    try {
      const locale = booking.locale === 'en' ? 'en' : 'sv';
      const { refundNotificationEmail } = await import('@/lib/email/refund-notification');
      const mail = refundNotificationEmail({
        locale,
        recipientName: booking.studentName,
        amountSek: opts?.amountSek ?? booking.grossChargedSek ?? null,
        bookingId,
      });
      await sendEmail({ to: booking.studentEmail, ...mail });
    } catch (err) {
      console.error('[refunds] refund notification email failed', err);
    }

    return {
      kind: 'refunded',
      refundId: refund.id,
      amountSek: opts?.amountSek ?? booking.grossChargedSek ?? null,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'refund_failed';
    // Idempotent Stripe retry — treat existing refund as success.
    if (message.includes('already been refunded') || message.includes('charge_already_refunded')) {
      await prisma.booking.update({
        where: { id: bookingId },
        data: { refundedAt: new Date() },
      });
      return { kind: 'duplicate', refundId: 'existing' };
    }
    console.error('[refunds] refund failed', { bookingId, message });
    await alertOps('Refund failed', [
      `Booking ${bookingId}: Stripe refund failed.`,
      message,
    ]);
    return { kind: 'error', message };
  }
}

/** Ops alert when a released booking is cancelled — transfer already sent. */
export async function alertReleasedCancelNeedsReview(bookingId: string): Promise<void> {
  await alertOps('Cancellation needs review — funds already released', [
    `Booking ${bookingId} was cancelled after payout release.`,
    'Manual Stripe reverse transfer / support review required.',
  ]);
}
